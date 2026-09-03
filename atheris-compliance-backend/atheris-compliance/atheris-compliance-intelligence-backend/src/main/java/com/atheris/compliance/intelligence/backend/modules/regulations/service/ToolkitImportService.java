package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulationAlias;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationAliasRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.intelligence.backend.shared.text.TextCleaner;
import com.atheris.compliance.common.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j @Service @RequiredArgsConstructor
public class ToolkitImportService {

    private final RegulatorRepository regulators;
    private final RegulationRepository actRepo;
    private final RegulationAliasRepository aliasRepo;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final RegulatoryReturnRepository returns;
    private final ComplianceControlRepository complianceControls;
    private final TransactionTemplate transactionTemplate;

    private static final List<String> CRMP_SECTIONS = List.of(
            "conduct_risk", "corporate_governance", "data_protection",
            "capital_market", "crmp", "esg", "cybersecurity", "consumer_protection",
            "abac", "amlcft", "actmgt", "cash_mgt");

    private static final Map<String, String> SECTION_AREA_OF_FOCUS = Map.ofEntries(
            Map.entry("conduct_risk", "Conduct Risk"),
            Map.entry("corporate_governance", "Corporate Governance"),
            Map.entry("data_protection", "Data Protection"),
            Map.entry("capital_market", "Capital Market"),
            Map.entry("crmp", "Compliance Risk Management"),
            Map.entry("esg", "ESG"),
            Map.entry("cybersecurity", "Cybersecurity"),
            Map.entry("consumer_protection", "Consumer Protection"),
            Map.entry("abac", "Anti-Bribery & Corruption"),
            Map.entry("amlcft", "AML/CFT"),
            Map.entry("actmgt", "Account Management"),
            Map.entry("cash_mgt", "Cash Management"));

    private final List<String> unmapped = new ArrayList<>();
    private int regulatorCount = 0;
    private int actCount = 0;
    private int instrumentCount = 0;
    private int obligationCount = 0;
    private int sanctionCount = 0;
    private int returnCount = 0;
    private int controlCount = 0;

    private static final Pattern CELL_SPLIT = Pattern.compile("\\|");

    public Map<String, Object> importToolkit() {
        unmapped.clear();
        regulatorCount = actCount = instrumentCount = obligationCount = sanctionCount = returnCount = controlCount = 0;
        try {
            return transactionTemplate.execute(status -> {
                try {
                    Resource res = new PathMatchingResourcePatternResolver()
                        .getResource("classpath:toolkit/compliance_toolkits.md");
                    try (InputStream is = res.getInputStream();
                         BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {

                        List<String> lines = reader.lines().toList();
                        Map<String, List<List<String>>> sections = parseSections(lines);

                        importUniverse(sections.getOrDefault("compliance_universe", List.of()));
                        for (String section : CRMP_SECTIONS) {
                            importCrmp(section, sections.getOrDefault(section, List.of()));
                        }
                        importSanctions(sections.getOrDefault("sanctions_and_penalties", List.of()));
                        importReturns(sections.getOrDefault("returns_and_remittance", List.of()));
                        importCmpControls(sections.getOrDefault("compliance_monitoring_plan", List.of()));
                        importCmpControlsFromSections(sections);
                    }
                    return successResult();
                } catch (Exception e) {
                    status.setRollbackOnly();
                    return errorResult(e);
                }
            });
        } catch (Exception e) {
            log.error("[ToolkitImport] Import failed: {}", e.getMessage(), e);
            String cause = e.getCause() != null
                ? String.valueOf(e.getCause().getMessage()) : "";
            return Map.of("error", e.getMessage(), "cause", cause,
                "regulators", regulatorCount, "acts", actCount,
                "instruments", instrumentCount, "obligations", obligationCount,
                "sanctions", sanctionCount, "returns", returnCount);
        }
    }

    private Map<String, Object> successResult() {
        return Map.of(
            "regulators", regulatorCount,
            "acts", actCount,
            "instruments", instrumentCount,
            "obligations", obligationCount,
            "sanctions", sanctionCount,
            "returns", returnCount,
            "controls", controlCount,
            "unmappedSources", unmapped.size(),
            "unmappedList", List.copyOf(unmapped)
        );
    }

    private Map<String, Object> errorResult(Exception e) {
        String cause = e.getCause() != null ? String.valueOf(e.getCause().getMessage()) : "";
        return Map.of("error", e.getMessage(), "cause", cause,
            "regulators", regulatorCount, "acts", actCount,
            "instruments", instrumentCount, "obligations", obligationCount,
            "sanctions", sanctionCount, "returns", returnCount, "controls", controlCount);
    }

    // ── Section parsing ──
    private Map<String, List<List<String>>> parseSections(List<String> lines) {
        Map<String, List<List<String>>> sections = new LinkedHashMap<>();
        String current = null;
        List<List<String>> rows = null;
        boolean inTable = false;

        for (String line : lines) {
            if (line.startsWith("## ")) {
                if (current != null && rows != null) sections.put(current, rows);
                current = normalizeSectionName(line.substring(3).trim());
                rows = new ArrayList<>();
                inTable = false;
            } else if (current != null) {
                if (line.startsWith("|")) {
                    inTable = true;
                    String[] cells = CELL_SPLIT.split(line);
                    List<String> row = new ArrayList<>();
                    for (String c : cells) row.add(c.trim());
                    // strip exactly one boundary empty from the leading/trailing pipe
                    if (!row.isEmpty() && row.get(0).isEmpty()) row.remove(0);
                    if (!row.isEmpty() && row.get(row.size() - 1).isEmpty()) row.remove(row.size() - 1);
                    // skip separator rows like |---|---|
                    boolean separator = row.stream().allMatch(c -> c.isEmpty() || c.matches("^-+$"));
                    if (!separator) rows.add(row);
                } else if (inTable) {
                    inTable = false;
                }
            }
        }
        if (current != null && rows != null) sections.put(current, rows);
        return sections;
    }

    private String normalizeSectionName(String raw) {
        return raw.toLowerCase(Locale.ROOT)
            .replaceAll("\\s+", "_")
            .replaceAll("[^a-z0-9_]", "");
    }

    // ── Compliance Universe → regulators + instruments + regulations ──
    @Transactional
    public void importUniverse(List<List<String>> rows) {
        if (rows.isEmpty()) return;
        Map<String, Integer> idx = headerIndex(rows.get(0));
        int cTitle = col(idx, "complianceobligationsource");
        int cDesc = col(idx, "objectivesdescription");
        int cIssue = col(idx, "dateofissue");
        int cComm = col(idx, "dateofcommencement");
        int cReg = col(idx, "regulatoryenforcementbodyindustrybody");
        int cType = col(idx, "typeofregulatoryitem");
        int cNature = col(idx, "natureofcomplianceitemcoretopicalpertinentsecondaryorothers", "natureofcomplianceitem");
        int cArea = col(idx, "areaoffocus");
        int cSanctions = col(idx, "sanctionsincludespecificsectionanddetaiilswherenotexplicitlystatedincludenotspecified", "sanctions");
        int cStatus = col(idx, "statuscurrentoutdated", "status");
        int cComment = col(idx, "commentonstatus");
        int cLink = col(idx, "linkofdocument");
        int cRisk = col(idx, "riskratingwithinthecommercialbankcontext", "riskrating");
        int cRiskExp = col(idx, "riskratingexplanation");
        int cRel = col(idx, "commercialbankrelevance");
        int cContext = col(idx, "commercialbankcompliancecontext");
        int cApp = col(idx, "applicabilitytocommercialbanks");

        for (int i = 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            if (isSubHeader(r, cTitle, cDesc)) continue;
            String title = get(r, cTitle);
            if (title == null || title.isBlank()) continue;
            String regBody = get(r, cReg);
            Integer regulatorId = regBody == null ? null : ensureRegulator(regBody);
            if (regulatorId == null && title != null) {
                regulatorId = inferRegulatorFromTitle(title);
            }
            if (regulatorId == null) regulatorId = inferRegulatorForAct(title);
            if (regulatorId == null) regulatorId = mapAreaToRegulator(get(r, cArea));
            if (regulatorId == null) regulatorId = ensureRegulator("Federal Government of Nigeria");

            if (instruments.existsBySourceTitle(title)) {
                log.info("[ToolkitImport] Skipping duplicate instrument: {}", title);
                continue;
            }

            Instrument inst = Instrument.builder()
                .sourceTitle(title)
                .dateIssued(parseDate(get(r, cIssue)))
                .dateCommencement(parseDate(get(r, cComm)))
                .regulatorId(regulatorId)
                .regulatoryItemType(get(r, cType))
                .nature(normalizeNature(get(r, cNature)))
                .areaOfFocus(get(r, cArea))
                .commentOnStatus(get(r, cComment))
                .riskRating(normalizeRisk(get(r, cRisk)))
                .riskRatingExplanation(get(r, cRiskExp))
                .commercialBankRelevance(get(r, cRel))
                .commercialBankComplianceContext(get(r, cContext))
                .applicabilityToCommercialBanks(normalizeYesNo(get(r, cApp)))
                .documentUrl(get(r, cLink))
                .status("Outdated".equalsIgnoreCase(get(r, cStatus)) ? Constants.INST_SUPERSEDED : Constants.INST_PUBLISHED)
                .uploadSource("toolkit_seed")
                .aiSummary(get(r, cDesc))
                .build();
            inst.setSourceReferenceNumber(extractReference(r));
            instruments.save(inst);
            instrumentCount++;

            // Now that the instrument exists, resolve (or create) its act and link it as canonical
            Long actId = findOrCreateAct(title, regulatorId);
            inst.setRegulationId(actId);
            instruments.save(inst);
            linkCanonicalInstrument(actRepo.findById(actId).orElse(null));

            // Sanctions described in the universe row (free text)
            String sanText = get(r, cSanctions);
            if (sanText != null && !sanText.isBlank()
                && !"Not Specified".equalsIgnoreCase(sanText)
                && !"Not specified".equalsIgnoreCase(sanText)) {
                sanctions.save(SanctionsPenalty.builder()
                    .instrumentId(inst.getInstrumentId())
                    .regulationId(actId)
                    .sanctionType("Regulatory")
                    .description(sanText)
                    .hasBeenEnforced(false)
                    .build());
                sanctionCount++;
            }
        }
    }

    // ── CRMP sheets → obligations ──
    @Transactional
    public void importCrmp(String sectionName, List<List<String>> rows) {
        if (rows.isEmpty()) return;
        Map<String, Integer> idx = headerIndex(rows.get(0));
        boolean colFormat = idx.containsKey("col0");

        // Col0..Col7 layout: col2=source, col3=section, col4=title, col5=desc, col6=plain
        // Named layout: header keys provide the same meaning
        int cSource = colFormat ? 2 : col(idx, "complianceobligationsource", "acts");
        int cSection = colFormat ? 3 : col(idx, "section");
        int cTitle = colFormat ? 4 : col(idx, "title");
        int cDesc = colFormat ? 5 : col(idx, "descriptionincludespecificsection", "description");
        int cPlain = colFormat ? 6 : col(idx, "translatetoclearandplainlanguagecomplianceobligation");
        int cType = col(idx, "obligationtype");
        int cDeadline = col(idx, "recurringdeadlinetype", "duedate");

        // Risk + owner columns (positional — consistent across all CRMP sections)
        // 17-col sections have Theme at index 1; 16-col sections don't → all indices shift by -1
        boolean hasTheme = idx.containsKey("theme");
        int cRiskDesc = colFormat ? 7 : (hasTheme ? 7 : 6);
        int cLikelihoodInherent = colFormat ? 8 : (hasTheme ? 8 : 7);
        int cImpactInherent = colFormat ? 9 : (hasTheme ? 9 : 8);
        int cControlOwner = colFormat ? 10 : (hasTheme ? 10 : 9);

        int obligNumber = 0;
        String lastSource = null;
        for (int i = 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            if (isSubHeader(r, cTitle, cDesc)) continue;

            String source = get(r, cSource);
            if (source == null || source.isBlank()) source = lastSource;
            if (source == null || source.isBlank()) continue;
            lastSource = source;

            String plain = get(r, cPlain);
            if (plain == null || plain.isBlank()) plain = get(r, cDesc);
            if (plain == null || plain.isBlank()) continue;

            Long actId = findOrCreateAct(source, null);
            Long instrumentId = ensureCanonicalInstrument(actRepo.findById(actId).orElse(null));

            String statement = TextCleaner.stripMarkdown(plain.trim());
            String sectionRef = shorten(get(r, cSection), 100);
            if (obligations.existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(
                    actId, statement, sectionRef)) {
                log.debug("[ToolkitImport] Skipping duplicate obligation for {}: {}...", source, statement.substring(0, Math.min(60, statement.length())));
                continue;
            }

            String likelihoodInherent = normalizeRiskLabel(get(r, cLikelihoodInherent));
            String impactInherent = normalizeRiskLabel(get(r, cImpactInherent));
            String inherentRiskRating = computeRiskBand(likelihoodInherent, impactInherent);

            obligations.save(ObligationMapping.builder()
                .instrumentId(instrumentId)
                .regulationId(actId)
                .obligationNumber(++obligNumber)
                .title(shorten(get(r, cTitle), 500))
                .plainEnglishStatement(statement)
                .specificSectionReference(sectionRef)
                .areaOfFocus(SECTION_AREA_OF_FOCUS.getOrDefault(sectionName, sectionName))
                .obligationType(shorten(get(r, cType), 100))
                .recurringDeadlineType(shorten(get(r, cDeadline), 50))
                .riskDescription(get(r, cRiskDesc))
                .inherentLikelihood(likelihoodInherent)
                .inherentImpact(impactInherent)
                .inherentRiskRating(inherentRiskRating)
                .controlOwner(get(r, cControlOwner))
                .build());
            obligationCount++;
        }
    }

    // ── Sanctions & Penalties grid ──
    @Transactional
    public void importSanctions(List<List<String>> rows) {
        if (rows.isEmpty()) return;
        // The grid has a junk header row (`| Col0 | Col1 | ...`) then real columns:
        // col1=regulation, col2=section, col3=violation, col4=penalty, col5=impact/risk, col6=liable parties
        String lastReg = null;
        for (List<String> r : rows) {
            String first = normalize(get(r, 0));
            if ("col0".equals(first) || "sn".equals(first)) continue;

            String regName = get(r, 1);
            if (regName == null || regName.isBlank()) regName = lastReg;
            if (regName == null || regName.isBlank()) continue;
            lastReg = regName;

            String section = get(r, 2);
            String violation = get(r, 3);
            if (violation == null || violation.isBlank()) continue;

            Long actId = findOrCreateAct(regName, null);
            Long instrumentId = ensureCanonicalInstrument(actRepo.findById(actId).orElse(null));

            String penalty = get(r, 4);
            String violationTrim = violation.trim();
            if (sanctions.existsByRegulationIdAndSourceSectionReferenceAndDescriptionAndPenaltyDetails(
                    actId, section, violationTrim, penalty)) {
                log.debug("[ToolkitImport] Skipping duplicate sanction for {}: {}...",
                    regName, violationTrim.substring(0, Math.min(80, violationTrim.length())));
                continue;
            }
            sanctions.save(SanctionsPenalty.builder()
                .instrumentId(instrumentId)
                .regulationId(actId)
                .sanctionType("Regulatory")
                .description(violation)
                .sourceSectionReference(section)
                .sanctionAmountNaira(parseMoney(penalty))
                .penaltyDetails(penalty)
                .riskExplanation(get(r, 5))
                .liableRoles(splitRoles(get(r, 6)))
                .hasBeenEnforced(false)
                .build());
            sanctionCount++;
        }
    }

    // ── Returns & Remittance register ──
    @Transactional
    public void importReturns(List<List<String>> rows) {
        if (rows.isEmpty()) return;
        // 8-column format: 0=SN(skip), 1=act, 2=title, 3=section, 4=description, 5=frequency, 6=responsible unit, 7=responsible person
        String lastAct = null;
        for (List<String> r : rows) {
            String actName = get(r, 1);
            if (actName == null || actName.isBlank()) actName = lastAct;
            if (actName == null || actName.isBlank()) continue;
            lastAct = actName;

            String title = get(r, 2);
            if (title == null || title.isBlank()) continue;

            Integer inferredRegulator = inferRegulatorForAct(actName);
            Long actId = findOrCreateAct(actName, inferredRegulator);
            // backfill regulator on existing acts that were created with null
            var actOpt = actRepo.findById(actId);
            if (actOpt.isPresent() && actOpt.get().getRegulatorId() == null && inferredRegulator != null) {
                actOpt.get().setRegulatorId(inferredRegulator);
                actRepo.save(actOpt.get());
            }
            if (returns.existsByTitleAndActId(title, actId)) continue;
            Long instrumentId = ensureCanonicalInstrument(actRepo.findById(actId).orElse(null));

            String section = get(r, 3);
            String description = get(r, 4);
            String freq = get(r, 5);
            String responsibleUnit = get(r, 6);
            String responsiblePerson = get(r, 7);

            LocalDate filingDate = parseFilingDate(freq);

            returns.save(RegulatoryReturn.builder()
                .actId(actId)
                .instrumentId(instrumentId)
                .title(shorten(title, 500))
                .sectionReference(shorten(section, 255))
                .statutoryBasis(description)
                .responsibleUnit(shorten(responsibleUnit, 255))
                .responsiblePerson(shorten(responsiblePerson, 255))
                .frequency(shorten(freq, 255))
                .frequencyType(classifyFrequency(freq))
                .deadline(freq)
                .filingDate(filingDate)
                .build());
            returnCount++;
        }
    }

    // ── Act resolution with alias map ──
    private Long findOrCreateAct(String title, Integer regulatorId) {
        if (regulatorId == null) {
            regulatorId = inferRegulatorForAct(title);
            if (regulatorId == null) regulatorId = inferRegulatorFromTitle(title);
        }
        if (title != null && title.length() > 500) {
            log.warn("[ToolkitImport] Act name too long ({} chars): {}", title.length(), title.substring(0, 250));
        }
        String normalizedKey = normalize(title);
        // Direct alias match (explicit hand-written mapping)
        var alias = aliasRepo.findByAlias(normalizedKey);
        if (alias.isPresent()) {
            Regulation reg = actRepo.findById(alias.get().getRegulationId()).orElse(null);
            if (reg != null) {
                if (reg.getCanonicalInstrumentId() == null) linkCanonicalInstrument(reg);
                return reg.getRegulationId();
            }
        }
        // Title match
        var byTitle = actRepo.findByName(title);
        if (byTitle.isPresent()) {
            Regulation reg = byTitle.get();
            if (reg.getCanonicalInstrumentId() == null) linkCanonicalInstrument(reg);
            return reg.getRegulationId();
        }
        // Normalized-name match
        Optional<Regulation> byNorm = actRepo.findAll().stream()
            .filter(r -> normalize(r.getName()).equals(normalizedKey))
            .findFirst();
        if (byNorm.isPresent()) {
            Regulation reg = byNorm.get();
            if (reg.getCanonicalInstrumentId() == null) linkCanonicalInstrument(reg);
            return reg.getRegulationId();
        }
        // Create new
        Regulation reg = Regulation.builder()
            .name(title)
            .regulatorId(regulatorId)
            .status("Active")
            .build();
        actRepo.save(reg);
        actCount++;
        try {
            aliasRepo.save(RegulationAlias.builder().alias(normalizedKey).regulationId(reg.getRegulationId()).build());
        } catch (Exception e) {
            log.warn("[ToolkitImport] Alias save failed ({}): {}", normalizedKey, e.getMessage());
        }
        linkCanonicalInstrument(reg);
        return reg.getRegulationId();
    }

    private void linkCanonicalInstrument(Regulation reg) {
        if (reg == null || reg.getCanonicalInstrumentId() != null) return;
        Optional<Instrument> canon = instruments.findBySourceTitle(reg.getName());
        if (canon.isEmpty()) {
            // try normalized match
            canon = instruments.findAll().stream()
                .filter(i -> normalize(i.getSourceTitle()).equals(normalize(reg.getName())))
                .findFirst();
        }
        if (canon.isPresent()) {
            reg.setCanonicalInstrumentId(canon.get().getInstrumentId());
            reg.setRegulatorId(reg.getRegulatorId() != null ? reg.getRegulatorId() : canon.get().getRegulatorId());
            actRepo.save(reg);
        }
        if (reg.getRegulatorId() == null) {
            Integer inf = inferRegulatorForAct(reg.getName());
            if (inf == null) inf = inferRegulatorFromTitle(reg.getName());
            if (inf == null) inf = mapAreaToRegulator(null);
            if (inf != null) {
                reg.setRegulatorId(inf);
                actRepo.save(reg);
            }
        }
    }

    // If the act has no canonical instrument (source appears only in CRMP/sanctions, not the universe),
    // create a stub instrument so obligations/sanctions have a home.
    private Long ensureCanonicalInstrument(Regulation reg) {
        if (reg == null) return null;
        if (reg.getRegulatorId() == null) {
            Integer inf = inferRegulatorForAct(reg.getName());
            if (inf == null) inf = inferRegulatorFromTitle(reg.getName());
            if (inf == null) inf = mapAreaToRegulator(null);
            if (inf != null) {
                reg.setRegulatorId(inf);
                actRepo.save(reg);
            }
        }
        if (reg.getCanonicalInstrumentId() != null) return reg.getCanonicalInstrumentId();
        Instrument stub = instruments.findBySourceTitle(reg.getName()).orElse(null);
        if (stub == null) {
            Integer stubRegId = reg.getRegulatorId();
            if (stubRegId == null) {
                stubRegId = inferRegulatorForAct(reg.getName());
                if (stubRegId == null) stubRegId = inferRegulatorFromTitle(reg.getName());
                if (stubRegId == null) stubRegId = mapAreaToRegulator(null);
            }
            stub = Instrument.builder()
                .sourceTitle(reg.getName())
                .regulatorId(stubRegId)
                .regulationId(reg.getRegulationId())
                .nature("Others")
                .status(Constants.INST_PUBLISHED)
                .uploadSource("toolkit_seed")
                .build();
            instruments.save(stub);
            instrumentCount++;
        } else if (stub.getRegulatorId() == null && reg.getRegulatorId() != null) {
            stub.setRegulatorId(reg.getRegulatorId());
            instruments.save(stub);
        } else if (stub.getRegulatorId() == null) {
            Integer inf2 = inferRegulatorForAct(reg.getName());
            if (inf2 == null) inf2 = inferRegulatorFromTitle(reg.getName());
            if (inf2 == null) inf2 = mapAreaToRegulator(null);
            if (inf2 != null) {
                stub.setRegulatorId(inf2);
                instruments.save(stub);
                if (reg.getRegulatorId() == null) {
                    reg.setRegulatorId(inf2);
                    actRepo.save(reg);
                }
            }
        }
        reg.setCanonicalInstrumentId(stub.getInstrumentId());
        actRepo.save(reg);
        String s = "no-universe-instrument=" + reg.getName();
        if (!unmapped.contains(s)) unmapped.add(s);
        return stub.getInstrumentId();
    }

    // ── Helpers ──
    private Integer inferRegulatorForAct(String actName) {
        if (actName == null) return null;
        String lower = actName.toLowerCase();
        if (lower.contains("pension") || lower.contains("pencom")) return 5;
        if (lower.contains("housing fund") || lower.contains("fmbn") || lower.contains("national housing")) return 34;
        if (lower.contains("fccpa") || lower.contains("federal competition and consumer protection")) return 7;
        if (lower.contains("stock exchange") || lower.contains("nse") || lower.contains("rulebook")) return 13;
        if (lower.contains("ndpa") || lower.contains("data protection") || lower.contains("ndpr") || lower.contains("nitda")) return 8;
        if (lower.contains("nimc") || lower.contains("national identity")) return 12;
        if (lower.contains("bvn") || lower.contains("bank verification")) return 1;
        if (lower.contains("tkyc") || lower.contains("three-tiered know your customer")) return 1;
        if (lower.contains("fx code") || lower.contains("foreign exchange code")) return 1;
        if (lower.contains("fx manual") || lower.contains("foreign exchange manual")) return 1;
        if (lower.contains("icaap") || lower.contains("supervisory review")) return 1;
        if (lower.contains("irrbb") || lower.contains("interest rate risk")) return 1;
        if (lower.contains("reputational risk")) return 1;
        if (lower.contains("stress testing")) return 1;
        if (lower.contains("leverage ratio")) return 1;
        if (lower.contains("lcr") || lower.contains("liquidity coverage")) return 1;
        if (lower.contains("whistle")) return 1;
        if (lower.contains("shared service")) return 1;
        if (lower.contains("regulatory capital")) return 1;
        if (lower.contains("basel")) return 1;
        if (lower.contains("agent banking")) return 1;
        if (lower.contains("sanef") || lower.contains("shared agency network")) return 1;
        if (lower.contains("prudential guideline")) return 1;
        if (lower.contains("efems") || lower.contains("electronic foreign exchange matching")) return 1;
        if (lower.contains("imto") || lower.contains("international money transfer")) return 1;
        if (lower.contains("diaspora remittance") || lower.contains("local currency liquidity")) return 1;
        if (lower.contains("consumer protection")) return 1;
        if (lower.contains("cybersecurity") || lower.contains("cybercrime")) return 1;
        if (lower.contains("blacklist")) return 1;
        if (lower.contains("corporate governance")) return 1;
        if (lower.contains("branch") && lower.contains("establishment")) return 1;
        if (lower.contains("minimum wage")) return 31;
        if (lower.contains("employee compensation") || lower.contains("nsitf")) return 17;
        if (lower.contains("trade union") || lower.contains("trade dispute")) return 31;
        if (lower.contains("bank employee") || lower.contains("declaration of assets")) return 1;
        if (lower.contains("ndic")) return 3;
        if (lower.contains("aml") || lower.contains("cft") || lower.contains("cpf")) return 1;
        if (lower.contains("pep") || lower.contains("politically exposed")) return 1;
        if (lower.contains("proliferation financing") || lower.contains("terrorism financing") || lower.contains("targeted financial sanctions")) return 1;
        if (lower.contains("frcn") || lower.contains("financial reporting council")) return 30;
        if (lower.contains("advance fee fraud")) return 1;
        if (lower.contains("cbn act")) return 1;
        if (lower.contains("itf") || lower.contains("industrial training")) return 29;
        if (lower.contains("cama") || lower.contains("companies and allied")) return 10;
        if (lower.contains("bofia") || lower.contains("banks and other financial")) return 1;
        if (lower.contains("foreign currency disclosure") || lower.contains("repatriation")) return 1;
        if (lower.contains("circular") && lower.contains("tier 1")) return 1;
        if (lower.contains("instant payment")) return 1;
        if (lower.contains("terrorism") && lower.contains("prevention")) return 1;
        // Tax family → FIRS
        if (lower.contains("cita") || lower.contains("companies income tax") || lower.contains("company income tax")
            || lower.contains("pita") || lower.contains("personal income tax")
            || lower.contains("cgta") || lower.contains("capital gains tax") || lower.contains("capital gains act")
            || lower.contains("stamp duties") || lower.contains("stamp duty")
            || lower.contains("value added tax") || lower.contains(" vat ") || lower.equals("vat") || lower.contains("vat act")
            || lower.contains("finance act") || lower.contains("petroleum profit") || lower.contains("petroleum profits")
            || lower.contains("tertiary education tax") || lower.contains("education tax")
            || lower.contains("withholding tax") || lower.contains("company income") || lower.contains("capital gains")) {
            return ensureRegulator("Federal Inland Revenue Service");
        }
        // Investment / Securities → SEC
        if (lower.contains("investment and securities") || lower.contains("securities act")
            || lower.contains("isa ") || lower.contains(" isa") || lower.trim().equals("isa") || lower.contains("securities and exchange")) {
            return ensureRegulator("Securities and Exchange Commission");
        }
        // Money laundering / proceeds of crime → NFIU (CBN as fallback for banks)
        if (lower.contains("money laundering") || lower.contains("proceeds of crime") || lower.contains("anti-money laundering")) {
            return ensureRegulator("Nigerian Financial Intelligence Unit");
        }
        // Constitution / evidence / arbitration / disability → Federal Govt
        if (lower.contains("constitution") || lower.contains("evidence act") || lower.contains("arbitration")
            || lower.contains("disability act") || lower.contains("discrimination against persons with disabilities")) {
            return ensureRegulator("Federal Government of Nigeria");
        }
        // Labour / employment catch-all
        if (lower.contains("labour") || lower.contains("labor") || lower.contains("employees compensation")
            || lower.contains("industrial training") || lower.contains("trade dispute")) {
            return ensureRegulator("Federal Ministry of Labour and Employment");
        }
        return null;
    }

    private Integer ensureRegulator(String body) {
        String name = body.trim();
        Regulator r = regulators.findByName(name).orElse(null);
        if (r == null) {
            String abbrOf = abbreviate(name);
            String normName = normalize(name);
            Optional<Regulator> byAbbr = regulators.findAll().stream()
                .filter(x -> {
                    String xAbbr = x.getAbbreviation() == null ? "" : x.getAbbreviation().toLowerCase(Locale.ROOT);
                    String xName = normalize(x.getName());
                    return (abbrOf != null && abbrOf.equalsIgnoreCase(xAbbr))
                        || (normName.length() >= 3 && xName.contains(normName))
                        || (xAbbr.length() >= 2 && normName.contains(xAbbr))
                        || name.toLowerCase(Locale.ROOT).contains(xAbbr);
                })
                .findFirst();
            r = byAbbr.orElse(null);
        }
        if (r == null) {
            r = Regulator.builder()
                .name(name)
                .abbreviation(abbreviate(name))
                .scraperEnabled(false)
                .isActive(true)
                .build();
            regulators.save(r);
            regulatorCount++;
        }
        return r.getRegulatorId();
    }

    private Integer inferRegulatorFromTitle(String title) {
        String t = title.toLowerCase(Locale.ROOT);
        if (t.contains("cbn") || t.contains("central bank")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("sec ") || t.contains("securities and exchange")) return ensureRegulator("Securities and Exchange Commission");
        if (t.contains("ndpc") || t.contains("data protection")) return ensureRegulator("Nigeria Data Protection Commission");
        if (t.contains("nimc") || t.contains("national identity")) return ensureRegulator("National Identity Management Commission");
        if (t.contains("fccpc") || t.contains("federal competition") || t.contains("consumer protection")) return ensureRegulator("Federal Competition and Consumer Protection Commission");
        if (t.contains("pencom") || t.contains("pension")) return ensureRegulator("National Pension Commission");
        if (t.contains("efcc") || t.contains("advance fee fraud")) return ensureRegulator("Economic and Financial Crimes Commission");
        if (t.contains("itf") || t.contains("industrial training fund")) return ensureRegulator("Industrial Training Fund");
        if (t.contains("fmbn") || t.contains("national housing fund") || t.contains("mortgage bank")) return ensureRegulator("Federal Mortgage Bank of Nigeria (FMBN)");
        if (t.contains("nse") || t.contains("nigerian stock exchange") || t.contains("ngx") || t.contains("nigerian exchange")) return ensureRegulator("Nigerian Stock Exchange (NSE)");
        if (t.contains("nitda") || t.contains("cybercrime")) return ensureRegulator("National Information Technology Development Agency (NITDA)");
        if (t.contains("firs") || t.contains("revenue service")) return ensureRegulator("Federal Inland Revenue Service");
        if (t.contains("ndic") || t.contains("deposit insurance")) return ensureRegulator("National Deposit Insurance Corporation");
        if (t.contains("naicom") || t.contains("insurance commission")) return ensureRegulator("National Insurance Commission");
        if (t.contains("frc") || t.contains("financial reporting council")) return ensureRegulator("Financial Reporting Council of Nigeria");
        if (t.contains("nfiu") || t.contains("financial intelligence")) return ensureRegulator("Nigerian Financial Intelligence Unit");
        if (t.contains("cac") || t.contains("corporate affairs")) return ensureRegulator("Corporate Affairs Commission");
        if (t.contains("dmo") || t.contains("debt management")) return ensureRegulator("Debt Management Office");
        if (t.contains("nipc") || t.contains("investment promotion")) return ensureRegulator("Nigerian Investment Promotion Commission (NIPC)");
        if (t.contains("nsitf") || t.contains("social insurance trust")) return ensureRegulator("Nigeria Social Insurance Trust Fund (NSITF)");
        if (t.contains("nctc") || t.contains("counter-terrorism")) return ensureRegulator("National Counter-Terrorism Centre (NCTC)");
        if (t.contains("nis") || t.contains("immigration")) return ensureRegulator("Nigeria Immigration Service (NIS)");
        if (t.contains("ndlea") || t.contains("drug law")) return ensureRegulator("National Drug Law Enforcement Agency (NDLEA)");
        if (t.contains("icpc")) return ensureRegulator("ICPC");
        if (t.contains("fgn") || t.contains("federal government")) return ensureRegulator("Federal Government of Nigeria");
        // ── Extended inference mirroring inferRegulatorForAct ──
        if (t.contains("cama") || t.contains("companies and allied")) return ensureRegulator("Corporate Affairs Commission");
        if (t.contains("bofia") || t.contains("banks and other financial")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("fccpa") || t.contains("fccpc") || t.contains("federal competition")) return ensureRegulator("Federal Competition and Consumer Protection Commission");
        if (t.contains("bvn") || t.contains("bank verification")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("tkyc") || t.contains("three-tiered know your customer")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("fx code") || t.contains("foreign exchange code") || t.contains("fx manual") || t.contains("foreign exchange manual")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("icaap") || t.contains("supervisory review")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("irrbb") || t.contains("interest rate risk")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("reputational risk") || t.contains("stress testing") || t.contains("leverage ratio") || t.contains("lcr") || t.contains("liquidity coverage")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("whistle") || t.contains("shared service") || t.contains("regulatory capital") || t.contains("basel")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("agent banking") || t.contains("sanef") || t.contains("shared agency network") || t.contains("prudential guideline")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("efems") || t.contains("electronic foreign exchange matching") || t.contains("imto") || t.contains("international money transfer") || t.contains("diaspora remittance") || t.contains("local currency liquidity")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("consumer protection")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("cybersecurity") || t.contains("cybercrime")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("blacklist") || t.contains("corporate governance") || (t.contains("branch") && t.contains("establishment"))) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("minimum wage") || t.contains("trade union") || t.contains("trade dispute") || t.contains("labour") || t.contains("labor")) return ensureRegulator("Federal Ministry of Labour and Employment");
        if (t.contains("employee compensation") || t.contains("nsitf")) return ensureRegulator("Nigeria Social Insurance Trust Fund (NSITF)");
        if (t.contains("aml") || t.contains("cft") || t.contains("cpf") || t.contains("proliferation financing") || t.contains("terrorism financing") || t.contains("targeted financial sanctions")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("advance fee fraud") || t.contains("cbn act") || t.contains("foreign currency disclosure") || t.contains("repatriation") || t.contains("instant payment") || t.contains("terrorism") && t.contains("prevention")) return ensureRegulator("Central Bank of Nigeria");
        if (t.contains("cita") || t.contains("companies income tax") || t.contains("company income tax") || t.contains("pita") || t.contains("personal income tax") || t.contains("cgta") || t.contains("capital gains") || t.contains("stamp duties") || t.contains("stamp duty") || t.contains("value added tax") || t.contains(" vat ") || t.contains("finance act") || t.contains("petroleum profit") || t.contains("tertiary education tax") || t.contains("education tax")) return ensureRegulator("Federal Inland Revenue Service");
        if (t.contains("investment and securities") || t.contains("isa") || t.contains("securities act") || t.contains("securities and exchange")) return ensureRegulator("Securities and Exchange Commission");
        if (t.contains("money laundering") || t.contains("proceeds of crime") || t.contains("anti-money laundering")) return ensureRegulator("Nigerian Financial Intelligence Unit");
        if (t.contains("constitution") || t.contains("evidence act") || t.contains("arbitration") || t.contains("disability") || t.contains("discrimination against persons")) return ensureRegulator("Federal Government of Nigeria");
        if (t.contains("firs") || t.contains("revenue service")) return ensureRegulator("Federal Inland Revenue Service");
        if (t.contains("lawfulness of purpose") || t.contains("ndpa") || t.contains("data protection")) return ensureRegulator("Nigeria Data Protection Commission");
        return null;
    }

    private Integer mapAreaToRegulator(String area) {
        if (area == null || area.isBlank()) return ensureRegulator("Federal Government of Nigeria");
        String a = area.toLowerCase(Locale.ROOT).trim();
        if (a.contains("tax")) return ensureRegulator("Federal Inland Revenue Service");
        if (a.contains("capital market")) return ensureRegulator("Securities and Exchange Commission");
        if (a.contains("labour") || a.contains("labor") || a.contains("employment") || a.contains("industrial relations")) return ensureRegulator("Federal Ministry of Labour and Employment");
        if (a.contains("pension")) return ensureRegulator("National Pension Commission");
        if (a.contains("data protection")) return ensureRegulator("Nigeria Data Protection Commission");
        if (a.contains("insurance") && !a.contains("deposit")) return ensureRegulator("National Insurance Commission");
        if (a.contains("deposit insurance")) return ensureRegulator("National Deposit Insurance Corporation");
        if (a.contains("financial reporting") || a.contains("frc")) return ensureRegulator("Financial Reporting Council of Nigeria");
        if (a.contains("consumer protection") || a.contains("competition")) return ensureRegulator("Federal Competition and Consumer Protection Commission");
        if (a.contains("aml") || a.contains("cft") || a.contains("cpf") || a.contains("financial intelligence")) return ensureRegulator("Nigerian Financial Intelligence Unit");
        if (a.contains("housing") || a.contains("mortgage")) return ensureRegulator("Federal Mortgage Bank of Nigeria (FMBN)");
        if (a.contains("identity") || a.contains("nimc")) return ensureRegulator("National Identity Management Commission");
        if (a.contains("cybersecurity") || a.contains("cybercrime") || a.contains("information technology")) return ensureRegulator("National Information Technology Development Agency (NITDA)");
        if (a.contains("payment") || a.contains("cash management") || a.contains("liquidity") || a.contains("monetary")
            || a.contains("credit risk") || a.contains("risk management") || a.contains("foreign exchange")
            || a.contains("account management") || a.contains("financial inclusion") || a.contains("mobile banking")
            || a.contains("licensing") || a.contains("capital adequacy") || a.contains("trade compliance")
            || a.contains("conduct risk") || a.contains("corporate governance") || a.contains("people and conduct")
            || a.contains("esg") || a.contains("anti-bribery") || a.contains("abac")) return ensureRegulator("Central Bank of Nigeria");
        return ensureRegulator("Federal Government of Nigeria");
    }

    private String abbreviate(String name) {
        String abbr = Arrays.stream(name.replaceAll("[()]", " ").split("\\s+"))
            .filter(w -> w.length() >= 3 && Character.isUpperCase(w.charAt(0)))
            .map(w -> String.valueOf(w.charAt(0)))
            .reduce("", String::concat);
        if (abbr.length() < 2) abbr = name.substring(0, Math.min(6, name.length())).toUpperCase(Locale.ROOT);
        return abbr.length() > 20 ? abbr.substring(0, 20) : abbr;
    }

    private Map<String, Integer> headerIndex(List<String> header) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            map.put(normalize(header.get(i)), i);
        }
        return map;
    }

    // Resolve a normalized header key (or candidates) to a column index
    private int col(Map<String, Integer> idx, String... candidates) {
        for (String c : candidates) {
            Integer exact = idx.get(c);
            if (exact != null) return exact;
        }
        // prefix fallback (long wrapper headers)
        for (String c : candidates) {
            for (Map.Entry<String, Integer> e : idx.entrySet()) {
                if (e.getKey().startsWith(c)) return e.getValue();
            }
        }
        return -1;
    }

    private boolean isSubHeader(List<String> row, int cTitle, int cDesc) {
        return get(row, cTitle) == null && get(row, cDesc) == null && row.size() >= 8 && !get(row, 8, "").isBlank();
    }

    private String get(List<String> row, int idx) {
        return get(row, idx, null);
    }

    private String get(List<String> row, int idx, String fallback) {
        if (idx < 0 || idx >= row.size()) return fallback;
        String v = row.get(idx);
        if (v == null || v.isBlank() || "None".equalsIgnoreCase(v) || "N/A".equalsIgnoreCase(v)) return fallback;
        return v;
    }

    private String shorten(String s, int max) {
        if (s == null || s.length() <= max) return s;
        return s.substring(0, max);
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]", "")
            .trim();
    }

    /**
     * Scans all cells of a toolkit row for a CBN-style document reference
     * (e.g. FPR/DIR/CIR/GEN/01/011, BSD/DIR/GEN/LAB/08/016, COD/DIR/INT/CIR/001/025).
     */
    private String extractReference(List<String> row) {
        for (String cell : row) {
            if (cell == null || cell.isBlank()) continue;
            Matcher m = Pattern.compile("\\b[A-Z]{2,6}/DIR/[A-Z/0-9]+", Pattern.CASE_INSENSITIVE).matcher(cell);
            if (m.find()) return m.group().trim();
        }
        return null;
    }

    private String normalizeNature(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT);
        if (v.contains("core")) return "Core";
        if (v.contains("topical") || v.contains("pertinent")) return "Topical/Pertinent";
        if (v.contains("secondary")) return "Secondary";
        if (v.contains("other")) return "Others";
        return null;
    }

    private String normalizeRisk(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT);
        if (v.contains("high")) return "High";
        if (v.contains("medium")) return "Medium";
        if (v.contains("low")) return "Low";
        return null;
    }

    private String normalizeRiskLabel(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT).trim();
        if (v.contains("very high") || v.contains("veryhigh")) return "Very High";
        if (v.contains("very low") || v.contains("verylow")) return "Very Low";
        if (v.contains("high")) return "High";
        if (v.contains("medium") || v.contains("moderate")) return "Medium";
        if (v.contains("low")) return "Low";
        return null;
    }

    private String computeRiskBand(String likelihood, String impact) {
        int l = riskScore(likelihood);
        int i = riskScore(impact);
        if (l <= 0 || i <= 0) return null;
        int score = l * i;
        if (score <= 3) return "Low";
        if (score <= 6) return "Moderate";
        if (score <= 9) return "High";
        return "Critical";
    }

    private int riskScore(String label) {
        if (label == null) return 0;
        return switch (label.toLowerCase(Locale.ROOT).trim()) {
            case "very low" -> 1;
            case "low" -> 2;
            case "medium", "moderate" -> 3;
            case "high" -> 4;
            case "very high" -> 5;
            default -> 0;
        };
    }

    private String normalizeYesNo(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT);
        if (v.contains("partially") || v.contains("conditional")) return "Partially";
        if (v.contains("yes") || v.contains("applicable")) return "Yes";
        if (v.contains("no") || v.contains("not applicable")) return "No";
        return null;
    }

    private static final DateTimeFormatter[] FORMATS = {
        DateTimeFormatter.ISO_LOCAL_DATE,
        new DateTimeFormatterBuilder().appendPattern("dd/MM/yyyy").toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("MMMM d, yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("MMM d, yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("d MMMM yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("yyyy-MM-dd HH:mm:ss").toFormatter()
    };

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String clean = s.trim().replace("00:00:00", "").trim();
        if (clean.isEmpty()) return null;
        for (DateTimeFormatter f : FORMATS) {
            try { return LocalDate.parse(clean, f); } catch (Exception ignored) { }
        }
        return null;
    }

    private java.math.BigDecimal parseMoney(String s) {
        if (s == null || s.isBlank()) return null;
        // Penalty cells hold compound per-role figures like "₦1.5M (MD & ECO), ₦1M (CCO), ₦20M (DMB)".
        // Parse each amount honoring M (million) / k (thousand) suffixes and return the largest.
        BigDecimal largest = null;
        for (String token : s.split("[,\\s]+")) {
            if (token.isBlank()) continue;
            BigDecimal v = parseMoneyToken(token);
            if (v != null && (largest == null || v.compareTo(largest) > 0)) largest = v;
        }
        if (largest == null) return null;
        // Column is numeric(15,2) — values >= 10^13 would overflow
        if (largest.compareTo(new BigDecimal("9999999999999.99")) > 0) {
            log.warn("[ToolkitImport] Sanction amount too large, skipping value: {}", s);
            return null;
        }
        return largest;
    }

    private static final Pattern MONEY_TOKEN =
        Pattern.compile("(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*([mMkK])?");
    private static final BigDecimal ONE_MILLION = new BigDecimal("1000000");
    private static final BigDecimal ONE_THOUSAND = new BigDecimal("1000");

    private BigDecimal parseMoneyToken(String token) {
        Matcher m = MONEY_TOKEN.matcher(token);
        if (!m.find()) return null;
        String raw = m.group(1).replace(",", "");
        BigDecimal v = new BigDecimal(raw);
        String suffix = m.group(2);
        if (suffix != null) {
            if (suffix.equalsIgnoreCase("m")) v = v.multiply(ONE_MILLION);
            else if (suffix.equalsIgnoreCase("k")) v = v.multiply(ONE_THOUSAND);
        }
        return v;
    }

    private List<String> splitRoles(String s) {
        if (s == null || s.isBlank()) return null;
        return Arrays.stream(s.split(","))
            .map(String::trim)
            .filter(x -> !x.isBlank())
            .toList();
    }

    /**
     * Classifies a raw frequency string into a type for instance generation.
     * Returns one of: DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, BIENNIAL, EVENT_DRIVEN.
     */
    private String classifyFrequency(String freq) {
        if (freq == null || freq.isBlank()) return "MONTHLY";
        String f = freq.trim().toLowerCase();

        // Event-driven patterns (check FIRST — these override recurring)
        if (f.contains("within") || f.contains("upon") || f.contains("on request")
            || f.contains("as required") || f.contains("as directed")
            || f.contains("as determined") || f.contains("as prescribed")
            || f.contains("immediately") || f.contains("no fixed timeline")
            || f.contains("ongoing") || f.contains("continuous")
            || f.contains("as detected") || f.contains("as disputes")
            || f.contains("per risk") || f.contains("triggered")
            || f.contains("from date") || f.contains("on-demand")
            || f.contains("during") || f.contains("in advance")
            || f.contains("at least") || f.contains("without delay")
            || f.contains("not less than") || f.contains("not later than")
                && !f.contains("month") && !f.contains("quarter") && !f.contains("year")
            || f.contains("after the meeting")
            || f.contains("after commencement")
            || f.contains("upon request")) {
            return "EVENT_DRIVEN";
        }

        // Recurring patterns
        if (f.contains("daily")) return "DAILY";
        if (f.contains("weekly")) return "WEEKLY";
        if (f.contains("semi") || f.contains("twice yearly") || f.contains("every 6 months"))
            return "SEMI_ANNUAL";
        if (f.contains("quarter")) return "QUARTERLY";
        if (f.contains("every 2 years") || f.contains("biennial")) return "BIENNIAL";
        if (f.contains("annual") || f.contains("annually") || f.contains("once per calendar year"))
            return "ANNUAL";
        if (f.contains("monthly")) return "MONTHLY";

        return "MONTHLY"; // default
    }

    /**
     * Parses a frequency/deadline string and returns a concrete filing date (day of current month),
     * or null when the frequency doesn't specify a concrete day (e.g. "Monthly", "Upon request").
     */
    private LocalDate parseFilingDate(String freq) {
        if (freq == null || freq.isBlank()) return null;
        String f = freq.trim().toLowerCase();

        // Pattern: "on or before the Xth"
        Matcher m = Pattern.compile("on\\s+or\\s+before\\s+(?:the\\s+)?(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return dayOfMonth(Integer.parseInt(m.group(1)));

        // Pattern: "by the Xth"
        m = Pattern.compile("by\\s+(?:the\\s+)?(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return dayOfMonth(Integer.parseInt(m.group(1)));

        // Pattern: "by end of the month" / "by the last working day"
        if (f.contains("end of") && (f.contains("month") || f.contains("working day"))) {
            return lastDayOfMonth();
        }

        // Pattern: "within X days after the month" → null (no specific day)
        if (f.contains("within") && f.contains("days") && f.contains("after")) return null;

        // Pattern: "upon request" / "as soon as possible" / "upon completion"
        if (f.contains("upon") || f.contains("as soon as")) return null;

        // Pattern: "X days after the board meeting" → null
        if (f.contains("after") && f.contains("meeting")) return null;

        // Pattern: "by end of first quarter" → March 31
        if (f.contains("first quarter")) return LocalDate.of(LocalDate.now().getYear(), 3, 31);
        if (f.contains("second quarter") || f.contains("half.year")) return null;
        if (f.contains("third quarter")) return null;
        if (f.contains("fourth quarter")) return null;

        // Pattern: "within X months after the quarter" → null
        if (f.contains("months") && f.contains("quarter")) return null;

        // Pattern: "within 6 months after the end of half-year" → null
        if (f.contains("months") && f.contains("half")) return null;

        // Fallback: extract any number with ordinal suffix
        m = Pattern.compile("(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return dayOfMonth(Integer.parseInt(m.group(1)));

        // Fallback: "X days after the month" → null
        return null;
    }

    private LocalDate dayOfMonth(int day) {
        LocalDate now = LocalDate.now();
        int maxDay = now.lengthOfMonth();
        return now.withDayOfMonth(Math.min(day, maxDay));
    }

    private LocalDate lastDayOfMonth() {
        LocalDate now = LocalDate.now();
        return now.withDayOfMonth(now.lengthOfMonth());
    }

    // ── CMP controls (Compliance Monitoring Plan) ──
    @Transactional
    public void importCmpControls(List<List<String>> rows) {
        if (rows.isEmpty()) return;

        String currentTheme = null;
        for (List<String> r : rows) {
            if (r.size() < 6) continue;

            // Column 0: theme (may be empty if continuing same theme)
            String themeCell = get(r, 0);
            if (themeCell != null && !themeCell.isBlank()) {
                // Skip sub-header rows (e.g., "Theme | ID | Regulatory Requirement | ...")
                if ("theme".equalsIgnoreCase(themeCell) || "id".equalsIgnoreCase(get(r, 1))) continue;
                currentTheme = themeCell.trim();
            }
            if (currentTheme == null) continue;

            // Column 1: control number (e.g., ABAC001)
            String controlNumber = get(r, 1);
            if (controlNumber == null || controlNumber.isBlank()) continue;
            controlNumber = controlNumber.trim();
            // Skip header repeats
            if ("id".equalsIgnoreCase(controlNumber)) continue;

            // Skip if already seeded (re-runnable)
            if (complianceControls.existsByControlNumber(controlNumber)) continue;

            // Column 2: regulatory requirement
            String regRequirement = get(r, 2);
            // Column 3: compliance area
            String complianceArea = get(r, 3);
            // Column 4: risk level
            String riskLevel = normalizeRisk(get(r, 4));
            // Column 5: compliance control (description)
            String complianceControl = get(r, 5);
            // Column 6: monitoring activity
            String monitoringActivity = get(r, 6);
            // Column 7: frequency
            String frequency = get(r, 7);
            // Column 8: responsible officer
            String responsibleOfficer = get(r, 8);
            // Column 9: due date
            String dueDate = get(r, 9);
            // Column 10: status
            String status = normalizeControlStatus(get(r, 10));
            // Column 11: control effectiveness measure
            String effectivenessMeasure = get(r, 11);

            // Match act from regulatory requirement text
            Long actId = null;
            if (regRequirement != null && !regRequirement.isBlank()) {
                String actName = extractActName(regRequirement);
                if (actName != null) {
                    actId = findOrCreateAct(actName, null);
                }
            }

            // Match obligation by section reference
            Long obligationId = null;
            if (actId != null && regRequirement != null) {
                String sectionRef = extractSectionRef(regRequirement);
                if (sectionRef != null) {
                    obligationId = obligations.findByRegulationId(actId).stream()
                        .filter(o -> o.getSpecificSectionReference() != null
                            && sectionRef.toLowerCase(Locale.ROOT)
                                .contains(o.getSpecificSectionReference().toLowerCase(Locale.ROOT)))
                        .findFirst()
                        .map(ObligationMapping::getObligationId)
                        .orElse(null);
                }
            }

            complianceControls.save(ComplianceControl.builder()
                .controlNumber(controlNumber)
                .theme(currentTheme)
                .regulatoryRequirement(regRequirement)
                .complianceArea(complianceArea)
                .riskLevel(riskLevel)
                .complianceControl(complianceControl)
                .monitoringActivity(monitoringActivity)
                .frequency(frequency)
                .responsibleOfficer(responsibleOfficer)
                .dueDate(dueDate)
                .status(status)
                .controlEffectivenessMeasure(effectivenessMeasure)
                .actId(actId)
                .actName(extractActName(regRequirement))
                .obligationId(obligationId)
                .build());
            controlCount++;
        }
        log.info("[ToolkitImport] CMP controls imported: {}", controlCount);
    }

    /**
     * Extracts the act name from a regulatory requirement string.
     * E.g., "EFCC Act 2004 - Section 34(3)" → "EFCC Act 2004"
     *       "ICPC Act 2003 - Section 13(1)" → "ICPC Act 2003"
     *       "CBN Cybersecurity Framework - Section 1.1" → "CBN Cybersecurity Framework"
     */
    private String extractActName(String regRequirement) {
        if (regRequirement == null) return null;
        // Try common delimiters: " - ", " — ", ": "
        String[] delimiters = {" - ", " — ", ": ", " – "};
        for (String d : delimiters) {
            int idx = regRequirement.indexOf(d);
            if (idx > 0) return regRequirement.substring(0, idx).trim();
        }
        // If no delimiter, try to find "Section" keyword
        int secIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("section");
        if (secIdx > 0) return regRequirement.substring(0, secIdx).trim();
        // Try "Rule" keyword
        int ruleIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("rule");
        if (ruleIdx > 0) return regRequirement.substring(0, ruleIdx).trim();
        // Try "Article" keyword
        int artIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("article");
        if (artIdx > 0) return regRequirement.substring(0, artIdx).trim();
        // Try "Principle" keyword
        int princIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("principle");
        if (princIdx > 0) return regRequirement.substring(0, princIdx).trim();
        // Try "Circular" keyword
        int circIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("circular");
        if (circIdx > 0) return regRequirement.substring(0, circIdx).trim();
        // Try "Guidelines" keyword
        int guidIdx = regRequirement.toLowerCase(Locale.ROOT).indexOf("guideline");
        if (guidIdx > 0) return regRequirement.substring(0, guidIdx).trim();
        return null;
    }

    /**
     * Extracts the section reference from a regulatory requirement string.
     * E.g., "EFCC Act 2004 - Section 34(3)" → "Section 34(3)"
     *       "SEC Rule 38(1)" → "Rule 38(1)"
     */
    private String extractSectionRef(String regRequirement) {
        if (regRequirement == null) return null;
        // Find after the act name delimiter
        String[] delimiters = {" - ", " — ", " – "};
        for (String d : delimiters) {
            int idx = regRequirement.indexOf(d);
            if (idx > 0 && idx + d.length() < regRequirement.length()) {
                return regRequirement.substring(idx + d.length()).trim();
            }
        }
        // Try after "Section", "Rule", "Article", etc.
        String lower = regRequirement.toLowerCase(Locale.ROOT);
        String[] keywords = {"section", "rule", "article", "principle", "paragraph", "regulation"};
        for (String kw : keywords) {
            int idx = lower.indexOf(kw);
            if (idx >= 0) return regRequirement.substring(idx).trim();
        }
        return null;
    }

    private String normalizeControlStatus(String s) {
        if (s == null || s.isBlank()) return "Open";
        String v = s.trim().toLowerCase(Locale.ROOT);
        if (v.contains("completed") || v.contains("done")) return "Completed";
        if (v.contains("progress") || v.contains("ongoing")) return "In Progress";
        return "Open";
    }

    // ── CRMP sections → extract Control + Additional Control ──
    @Transactional
    public void importCmpControlsFromSections(Map<String, List<List<String>>> sections) {
        int cmpCount = 0;
        for (String sectionName : CRMP_SECTIONS) {
            List<List<String>> rows = sections.getOrDefault(sectionName, List.of());
            if (rows.isEmpty()) continue;
            Map<String, Integer> idx = headerIndex(rows.get(0));
            boolean colFormat = idx.containsKey("col0");

            int cSource = colFormat ? 2 : col(idx, "complianceobligationsource", "acts");
            int cSection = colFormat ? 3 : col(idx, "section");
            int cTitle = colFormat ? 4 : col(idx, "title");
            int cDesc = colFormat ? 5 : col(idx, "descriptionincludespecificsection", "description");

            // Col 11=Control, 12=Residual Likelihood, 13=Residual Impact, 14=Additional Control, 16=Responsibility
            int cControl = 11;
            int cLikelihoodResidual = 12;
            int cImpactResidual = 13;
            int cAdditionalControl = 14;
            int cControlOwner = 16;

            String lastSource = null;
            for (int i = 1; i < rows.size(); i++) {
                List<String> r = rows.get(i);
                if (isSubHeader(r, cTitle, cDesc)) continue;

                String source = get(r, cSource);
                if (source == null || source.isBlank()) source = lastSource;
                if (source == null || source.isBlank()) continue;
                lastSource = source;

                // Resolve regulation
                Long actId = findOrCreateAct(source, null);
                String sectionRef = get(r, cSection);

                // Match ALL obligations by section reference for this regulation
                List<Long> matchedObligationIds = matchObligationsBySection(actId, sectionRef);
                String linkedIds = matchedObligationIds.isEmpty() ? null
                    : matchedObligationIds.stream().map(String::valueOf).collect(Collectors.joining(","));

                // Residual risk
                String likelihoodResidual = normalizeRiskLabel(get(r, cLikelihoodResidual));
                String impactResidual = normalizeRiskLabel(get(r, cImpactResidual));
                String residualRiskRating = computeRiskBand(likelihoodResidual, impactResidual);

                // Primary Control (col 11)
                String controlText = get(r, cControl);
                if (controlText != null && !controlText.isBlank()) {
                    String ctrlNum = sectionName.toUpperCase(Locale.ROOT).substring(0, Math.min(4, sectionName.length())) + "C" + String.format("%03d", cmpCount + 1);
                    if (!complianceControls.existsByControlNumber(ctrlNum)) {
                        complianceControls.save(ComplianceControl.builder()
                            .controlNumber(ctrlNum)
                            .theme(SECTION_AREA_OF_FOCUS.getOrDefault(sectionName, sectionName))
                            .regulatoryRequirement(source)
                            .complianceArea(sectionName)
                            .riskLevel(normalizeRisk(get(r, cTitle)))
                            .complianceControl(controlText)
                            .controlType("PRIMARY")
                            .residualLikelihood(likelihoodResidual)
                            .residualImpact(impactResidual)
                            .residualRiskRating(residualRiskRating)
                            .ownerName(get(r, cControlOwner))
                            .actId(actId)
                            .actName(source)
                            .linkedObligationIds(linkedIds)
                            .status("Open")
                            .build());
                        cmpCount++;
                    }
                }

                // Additional Control (col 14)
                String additionalText = get(r, cAdditionalControl);
                if (additionalText != null && !additionalText.isBlank()) {
                    String ctrlNum = sectionName.toUpperCase(Locale.ROOT).substring(0, Math.min(4, sectionName.length())) + "A" + String.format("%03d", cmpCount + 1);
                    if (!complianceControls.existsByControlNumber(ctrlNum)) {
                        complianceControls.save(ComplianceControl.builder()
                            .controlNumber(ctrlNum)
                            .theme(SECTION_AREA_OF_FOCUS.getOrDefault(sectionName, sectionName))
                            .regulatoryRequirement(source)
                            .complianceArea(sectionName)
                            .riskLevel(normalizeRisk(get(r, cTitle)))
                            .complianceControl(additionalText)
                            .controlType("ADDITIONAL")
                            .residualLikelihood(likelihoodResidual)
                            .residualImpact(impactResidual)
                            .residualRiskRating(residualRiskRating)
                            .ownerName(get(r, cControlOwner))
                            .actId(actId)
                            .actName(source)
                            .linkedObligationIds(linkedIds)
                            .status("Open")
                            .build());
                        cmpCount++;
                    }
                }
            }
        }
        controlCount += cmpCount;
        log.info("[ToolkitImport] CRMP section controls imported: {}", cmpCount);
    }

    private List<Long> matchObligationsBySection(Long regulationId, String sectionRef) {
        if (sectionRef == null || sectionRef.isBlank()) return List.of();
        return obligations.findByRegulationId(regulationId).stream()
            .filter(o -> {
                String oRef = o.getSpecificSectionReference();
                if (oRef == null || oRef.isBlank()) return false;
                String norm = sectionRef.toLowerCase(Locale.ROOT).trim();
                return norm.contains(oRef.toLowerCase(Locale.ROOT).trim())
                    || oRef.toLowerCase(Locale.ROOT).trim().contains(norm);
            })
            .map(ObligationMapping::getObligationId)
            .toList();
    }
}
