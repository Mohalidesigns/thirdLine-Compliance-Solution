package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulationAlias;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
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

@Slf4j @Service @RequiredArgsConstructor
public class ToolkitImportService {

    private final RegulatorRepository regulators;
    private final RegulationRepository regulationRepo;
    private final RegulationAliasRepository aliasRepo;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final RegulatoryReturnRepository returns;
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
    private int regulationCount = 0;
    private int instrumentCount = 0;
    private int obligationCount = 0;
    private int sanctionCount = 0;
    private int returnCount = 0;

    private static final Pattern CELL_SPLIT = Pattern.compile("\\|");

    public Map<String, Object> importToolkit() {
        unmapped.clear();
        regulatorCount = regulationCount = instrumentCount = obligationCount = sanctionCount = returnCount = 0;
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
                "regulators", regulatorCount, "regulations", regulationCount,
                "instruments", instrumentCount, "obligations", obligationCount,
                "sanctions", sanctionCount, "returns", returnCount);
        }
    }

    private Map<String, Object> successResult() {
        return Map.of(
            "regulators", regulatorCount,
            "regulations", regulationCount,
            "instruments", instrumentCount,
            "obligations", obligationCount,
            "sanctions", sanctionCount,
            "returns", returnCount,
            "unmappedSources", unmapped.size(),
            "unmappedList", List.copyOf(unmapped)
        );
    }

    private Map<String, Object> errorResult(Exception e) {
        String cause = e.getCause() != null ? String.valueOf(e.getCause().getMessage()) : "";
        return Map.of("error", e.getMessage(), "cause", cause,
            "regulators", regulatorCount, "regulations", regulationCount,
            "instruments", instrumentCount, "obligations", obligationCount,
            "sanctions", sanctionCount, "returns", returnCount);
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

            // Now that the instrument exists, resolve (or create) its regulation and link it as canonical
            Long regulationId = findOrCreateRegulation(title, regulatorId);
            inst.setRegulationId(regulationId);
            instruments.save(inst);
            linkCanonicalInstrument(regulationRepo.findById(regulationId).orElse(null));

            // Sanctions described in the universe row (free text)
            String sanText = get(r, cSanctions);
            if (sanText != null && !sanText.isBlank()
                && !"Not Specified".equalsIgnoreCase(sanText)
                && !"Not specified".equalsIgnoreCase(sanText)) {
                sanctions.save(SanctionsPenalty.builder()
                    .instrumentId(inst.getInstrumentId())
                    .regulationId(regulationId)
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

            Long regulationId = findOrCreateRegulation(source, null);
            Long instrumentId = ensureCanonicalInstrument(regulationRepo.findById(regulationId).orElse(null));

            String statement = TextCleaner.stripMarkdown(plain.trim());
            String sectionRef = shorten(get(r, cSection), 100);
            if (obligations.existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(
                    regulationId, statement, sectionRef)) {
                log.debug("[ToolkitImport] Skipping duplicate obligation for {}: {}...", source, statement.substring(0, Math.min(60, statement.length())));
                continue;
            }

            obligations.save(ObligationMapping.builder()
                .instrumentId(instrumentId)
                .regulationId(regulationId)
                .obligationNumber(++obligNumber)
                .plainEnglishStatement(statement)
                .specificSectionReference(sectionRef)
                .areaOfFocus(SECTION_AREA_OF_FOCUS.getOrDefault(sectionName, sectionName))
                .obligationType(shorten(get(r, cType), 100))
                .recurringDeadlineType(shorten(get(r, cDeadline), 50))
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

            Long regulationId = findOrCreateRegulation(regName, null);
            Long instrumentId = ensureCanonicalInstrument(regulationRepo.findById(regulationId).orElse(null));

            String penalty = get(r, 4);
            String violationTrim = violation.trim();
            if (sanctions.existsByRegulationIdAndSourceSectionReferenceAndDescriptionAndPenaltyDetails(
                    regulationId, section, violationTrim, penalty)) {
                log.debug("[ToolkitImport] Skipping duplicate sanction for {}: {}...",
                    regName, violationTrim.substring(0, Math.min(80, violationTrim.length())));
                continue;
            }
            sanctions.save(SanctionsPenalty.builder()
                .instrumentId(instrumentId)
                .regulationId(regulationId)
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
        // cols: 1=regulation, 2=return title, 3=section, 4=description, 5=frequency/deadline, 6=responsible role
        String lastReg = null;
        for (List<String> r : rows) {
            String regName = get(r, 1);
            if (regName == null || regName.isBlank()) regName = lastReg;
            if (regName == null || regName.isBlank()) continue;
            lastReg = regName;

            String title = get(r, 2);
            if (title == null || title.isBlank()) continue;

            Long regulationId = findOrCreateRegulation(regName, null);
            if (returns.existsByTitleAndRegulationId(title, regulationId)) continue;
            Long instrumentId = ensureCanonicalInstrument(regulationRepo.findById(regulationId).orElse(null));

            String section = get(r, 3);
            String description = get(r, 4);
            String freq = get(r, 5);
            returns.save(RegulatoryReturn.builder()
                .regulationId(regulationId)
                .instrumentId(instrumentId)
                .title(shorten(title, 500))
                .sectionReference(shorten(section, 255))
                .statutoryBasis(description)
                .recipient(shorten(get(r, 6), 255))
                .frequency(shorten(freq, 255))
                .deadline(freq)
                .build());
            returnCount++;
        }
    }

    // ── Regulation resolution with alias map ──
    private Long findOrCreateRegulation(String title, Integer regulatorId) {
        if (title != null && title.length() > 500) {
            log.warn("[ToolkitImport] Regulation name too long ({} chars): {}", title.length(), title.substring(0, 250));
        }
        String normalizedKey = normalize(title);
        // Direct alias match (explicit hand-written mapping)
        var alias = aliasRepo.findByAlias(normalizedKey);
        if (alias.isPresent()) {
            Regulation reg = regulationRepo.findById(alias.get().getRegulationId()).orElse(null);
            if (reg != null) {
                if (reg.getCanonicalInstrumentId() == null) linkCanonicalInstrument(reg);
                return reg.getRegulationId();
            }
        }
        // Title match
        var byTitle = regulationRepo.findByName(title);
        if (byTitle.isPresent()) {
            Regulation reg = byTitle.get();
            if (reg.getCanonicalInstrumentId() == null) linkCanonicalInstrument(reg);
            return reg.getRegulationId();
        }
        // Normalized-name match
        Optional<Regulation> byNorm = regulationRepo.findAll().stream()
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
        regulationRepo.save(reg);
        regulationCount++;
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
            regulationRepo.save(reg);
        }
    }

    // If the regulation has no canonical instrument (source appears only in CRMP/sanctions, not the universe),
    // create a stub instrument so obligations/sanctions have a home.
    private Long ensureCanonicalInstrument(Regulation reg) {
        if (reg == null) return null;
        if (reg.getCanonicalInstrumentId() != null) return reg.getCanonicalInstrumentId();
        Instrument stub = instruments.findBySourceTitle(reg.getName()).orElse(null);
        if (stub == null) {
            stub = Instrument.builder()
                .sourceTitle(reg.getName())
                .regulatorId(reg.getRegulatorId())
                .regulationId(reg.getRegulationId())
                .nature("Others")
                .status(Constants.INST_PUBLISHED)
                .uploadSource("toolkit_seed")
                .build();
            instruments.save(stub);
            instrumentCount++;
        }
        reg.setCanonicalInstrumentId(stub.getInstrumentId());
        regulationRepo.save(reg);
        String s = "no-universe-instrument=" + reg.getName();
        if (!unmapped.contains(s)) unmapped.add(s);
        return stub.getInstrumentId();
    }

    // ── Helpers ──
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
}
