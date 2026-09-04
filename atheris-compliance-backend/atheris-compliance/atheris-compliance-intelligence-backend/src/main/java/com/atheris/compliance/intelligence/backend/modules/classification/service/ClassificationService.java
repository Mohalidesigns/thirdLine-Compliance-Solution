package com.atheris.compliance.intelligence.backend.modules.classification.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.classification.dto.ClassificationResult;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.jobs.service.JobQueueService;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulationAlias;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationAliasRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.intelligence.backend.shared.ai.AiClient;
import com.atheris.compliance.intelligence.backend.shared.text.TextCleaner;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ClassificationService {

    private final AiClient aiClient;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final RegulatorRepository regulators;
    private final RegulationRepository actRepo;
    private final RegulationAliasRepository aliasRepo;
    private final SanctionsRepository sanctionsRepo;
    private final JobQueueService jobQueue;
    private final ObjectMapper mapper;

    @PersistenceContext
    private EntityManager em;

    // Toolkit parity 12 SECTION_AREA_OF_FOCUS values
    private static final String ALLOWED_AREAS = """
        AML/CFT, Corporate Governance, Cash Management,
        Data Protection, Consumer Protection, Cybersecurity,
        Anti-Bribery & Corruption, ESG, Capital Market,
        Account Management, Financial Reporting, Compliance Risk Management, Conduct Risk""";

    private static final String PROMPT = """
        You are a Nigerian financial regulatory compliance expert.
        Analyse the regulatory document text and return ONLY valid JSON with these fields:
        {
          "act_name": string | null (parent Act/Regulation name, e.g. "Banks and Other Financial Institutions Act 2020", "CBN Circular on Cybersecurity"),
          "area_of_focus": string (one of: AML/CFT, Corporate Governance, Cash Management,
            Data Protection, Consumer Protection, Cybersecurity, Anti-Bribery & Corruption, ESG, Capital Market,
            Account Management, Financial Reporting, Compliance Risk Management, Conduct Risk),
          "nature": "Core" | "Secondary" | "Guidance" | "Topical/Pertinent" | "Others",
          "risk_rating": "High" | "Medium" | "Low",
          "risk_rating_explanation": string | null (1-2 sentences why this rating),
          "regulatory_item_type": string | null (Act | Circular | Guideline | Framework | Regulation | Directive | Notice | Policy),
          "applicability_to_commercial_banks": "Yes" | "No" | "Partially" | null,
          "licence_types_applicable": string[],
          "applicability_confidence": number (0.0 to 1.0),
          "ai_summary": string (3-5 plain English sentences),
          "reference_number": string | null (official reference e.g. "FPR/DIR/CIR/GEN/01/011"; derive from header ISSN/volume if needed; null only if none),
          "regulator": string (full name of issuing body, e.g. "Central Bank of Nigeria"),
          "date_of_issue": string | null (ISO date YYYY-MM-DD if stated in document header, else null),
          "date_of_commencement": string | null (ISO date YYYY-MM-DD if commencement/effective date stated, else null),
          "obligations": [
            {
              "number": integer | null,
              "title": string (short phrase 3-8 words, e.g. "Maintain capital adequacy ratio"),
              "statement": string (single enforceable sentence, interpreted plain English, MUST be <=250 chars, e.g. "Banks must maintain a minimum capital adequacy ratio of 15%%."),
              "description": string (verbatim excerpt from source text, 1-2 sentences, <=500 chars),
              "section_reference": string | null (e.g. "Section 12(3)", "Rule 38(1)", "Para 4.2"),
              "type": "Operational" | "Reporting" | "Governance" | "One-time",
              "recurring_deadline": "Continuous" | "Monthly" | "Quarterly" | "Annual" | "One-time" | "Daily" | null,
              "area_of_focus": string (same 12 values as above; per-obligation area),
              "risk_description": string | null (what risk materialises if breached),
              "likelihood": "Very Low" | "Low" | "Medium" | "High" | "Very High" | null,
              "impact": "Very Low" | "Low" | "Medium" | "High" | "Very High" | null,
              "control_owner": string | null (role like "CCO", "Head IT", "Treasurer", "Chief Risk Officer", "MD/CEO")
            }
          ],
          "sanctions": [
            {
              "description": string (violation description),
              "section_reference": string | null,
              "penalty_details": string | null (raw penalty text, e.g. "₦20M (DMB), ₦1M (CCO)"),
              "risk_explanation": string | null,
              "sanction_amount": string | null (largest monetary amount, e.g. "₦20,000,000"),
              "liable_roles": string[] | null (e.g. ["MD & ECO","CCO","DMB"]),
              "sanction_type": string | null (Regulatory | Criminal | Administrative)
            }
          ]
        }

        CRITICAL ATOMICITY RULES:
        - Extract ONE obligation per individual duty. If text lists (a)(b)(c) or numbered sub-clauses, emit SEPARATE objects.
        - "statement" MUST be a single enforceable sentence <=250 chars, interpreted plain English (not verbatim).
        - "description" is the verbatim source excerpt <=500 chars; do not combine multiple duties.
        - "title" is a short 3-8 word phrase summarising the duty.
        - Include "likelihood", "impact" (Very Low/Low/Medium/High/Very High) and "control_owner" (bank role) per obligation where inferable; null if not inferable.
        - "risk_description" explains the regulatory risk of non-compliance.
        - Populate "sanctions" array whenever penalties/fines/sanctions are mentioned; leave empty [] otherwise.
        - Provide "act_name" for the parent Act/Regulation this instrument belongs to (e.g. "BOFIA 2020"); null if purely standalone circular with no parent Act.
        - "area_of_focus" must be one of the 12 allowed values listed above.

        JSON EXAMPLE (both description verbatim and statement interpreted):
        {
          "act_name": "Banks and Other Financial Institutions Act 2020",
          "area_of_focus": "Corporate Governance",
          "nature": "Core",
          "risk_rating": "High",
          "risk_rating_explanation": "Failure to maintain capital adequacy directly threatens systemic stability.",
          "regulatory_item_type": "Circular",
          "applicability_to_commercial_banks": "Yes",
          "licence_types_applicable": ["Commercial Bank"],
          "applicability_confidence": 0.92,
          "ai_summary": "The circular mandates capital adequacy...",
          "reference_number": "BSD/DIR/GEN/LAB/08/016",
          "regulator": "Central Bank of Nigeria",
          "date_of_issue": "2024-12-15",
          "date_of_commencement": "2025-01-01",
          "obligations": [
            {
              "number": 1,
              "title": "Maintain capital adequacy ratio",
              "statement": "Banks must maintain a minimum capital adequacy ratio of 15%% at all times.",
              "description": "Every bank shall maintain a ratio of capital to risk-weighted assets of not less than 15 per centum.",
              "section_reference": "Section 12(3)",
              "type": "Governance",
              "recurring_deadline": "Continuous",
              "area_of_focus": "Corporate Governance",
              "risk_description": "Breach exposes bank to regulatory sanctions and potential licence withdrawal.",
              "likelihood": "Medium",
              "impact": "High",
              "control_owner": "Chief Risk Officer"
            }
          ],
          "sanctions": [
            {
              "description": "Failure to maintain capital adequacy ratio",
              "section_reference": "Section 12(3)",
              "penalty_details": "₦20M (DMB), ₦1M (CCO)",
              "risk_explanation": "Systemic undercapitalisation",
              "sanction_amount": "₦20,000,000",
              "liable_roles": ["DMB","CCO"],
              "sanction_type": "Regulatory"
            }
          ]
        }

        Allowed area_of_focus values (strict): AML/CFT, Corporate Governance, Cash Management, Data Protection, Consumer Protection, Cybersecurity, Anti-Bribery & Corruption, ESG, Capital Market, Account Management, Financial Reporting, Compliance Risk Management, Conduct Risk
        Allowed nature: Core, Secondary, Guidance, Topical/Pertinent, Others
        Allowed risk_rating: High, Medium, Low
        Allowed likelihood/impact: Very Low, Low, Medium, High, Very High
        Allowed control_owner examples: CCO, Head IT, Treasurer, Chief Risk Officer, MD/CEO, Head Compliance, Head Operations, Company Secretary

        No preamble. No markdown. Pure JSON only.
        Document text:
        %s
        """;

    @Transactional
    public void classifyAsync(Long instrumentId, String ocrText) {
        try {
            if (ocrText == null || ocrText.length() < 100) {
                log.warn("Instrument {} OCR text too short ({} chars) — marking for manual review", instrumentId, ocrText == null ? 0 : ocrText.length());
                instruments.findById(instrumentId).ifPresent(inst -> {
                    inst.setStatus(Constants.INST_TRIAGE);
                    instruments.save(inst);
                });
                return;
            }
            ClassificationResult result = callLLm(ocrText);
            applyClassification(instrumentId, result, ocrText);
            jobQueue.enqueue(Constants.JOB_APPLICABILITY, instrumentId,
                Map.of("instrument_id", instrumentId), "classifier");
            log.info("Classified instrument {}: {} / {} act={} obligations={} sanctions={}", instrumentId,
                result.getAreaOfFocus(), result.getRiskRating(), result.getActName(),
                result.getObligations() != null ? result.getObligations().size() : 0,
                result.getSanctions() != null ? result.getSanctions().size() : 0);
        } catch (Throwable e) {
            log.error("Classification failed for instrument {}: {}", instrumentId, e.getMessage(), e);
            try { if (em != null) em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw new RuntimeException(e);
        }
    }

    public ClassificationResult classifySync(Long instrumentId, String ocrText) {
        try {
            ClassificationResult result = callLLm(ocrText);
            applyClassification(instrumentId, result, ocrText);
            return result;
        } catch (Throwable e) {
            log.error("classifySync failed for {}: {}", instrumentId, e.getMessage(), e);
            try { if (em != null) em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw new RuntimeException(e);
        }
    }

    // ── LLM call with chunking (80k cap, split >40k into 2) ──
    private ClassificationResult callLLm(String ocrText) {
        if (ocrText == null) throw new RuntimeException("ocrText null");
        // hard cap 80k
        String truncated = ocrText.substring(0, Math.min(80_000, ocrText.length()));
        if (truncated.length() <= 40_000) {
            return callSingle(truncated);
        }
        // split into 2 chunks ~40k each
        String chunk1 = truncated.substring(0, 40_000);
        String chunk2 = truncated.substring(40_000);
        log.info("Chunking OCR text {} chars into 2 calls ({} + {})", truncated.length(), chunk1.length(), chunk2.length());
        ClassificationResult r1 = callSingle(chunk1);
        ClassificationResult r2 = callSingle(chunk2);
        return mergeResults(r1, r2);
    }

    private ClassificationResult callSingle(String chunk) {
        String prompt = PROMPT.formatted(chunk);
        String response = aiClient.complete(prompt);
        try {
            String clean = response.replaceAll("```json|```", "").trim();
            // trim any leading/trailing non-JSON
            int firstBrace = clean.indexOf('{');
            int lastBrace = clean.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) clean = clean.substring(firstBrace, lastBrace + 1);
            ClassificationResult result = mapper.readValue(clean, ClassificationResult.class);
            if (result.getObligations() == null) result.setObligations(List.of());
            if (result.getSanctions() == null) result.setSanctions(List.of());
            return result;
        } catch (Exception e) {
            log.error("Failed to parse AI response ({} chars): {}", response.length(), response.substring(0, Math.min(800, response.length())));
            throw new RuntimeException("Failed to parse AI response: " + e.getMessage(), e);
        }
    }

    private ClassificationResult mergeResults(ClassificationResult r1, ClassificationResult r2) {
        if (r1 == null) return r2;
        if (r2 == null) return r1;
        // merge obligations deduplicated by normalized statement
        List<ClassificationResult.ObligationItem> mergedObs = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (ClassificationResult.ObligationItem o : r1.getObligations()) {
            String key = normalizeKey(o.getStatement() != null ? o.getStatement() : o.getDescription());
            if (key.isBlank() || seen.add(key)) mergedObs.add(o);
        }
        for (ClassificationResult.ObligationItem o : r2.getObligations()) {
            String key = normalizeKey(o.getStatement() != null ? o.getStatement() : o.getDescription());
            if (key.isBlank() || seen.add(key)) mergedObs.add(o);
        }
        List<ClassificationResult.SanctionItem> mergedSanc = new ArrayList<>();
        Set<String> seenS = new HashSet<>();
        if (r1.getSanctions() != null) mergedSanc.addAll(r1.getSanctions());
        if (r2.getSanctions() != null) {
            for (ClassificationResult.SanctionItem s : r2.getSanctions()) {
                String k = normalizeKey((s.getDescription() != null ? s.getDescription() : "") + "|" + (s.getSectionReference() != null ? s.getSectionReference() : ""));
                if (k.isBlank() || seenS.add(k)) {
                    // avoid duplicates already in r1
                    String k2 = normalizeKey((s.getDescription() != null ? s.getDescription() : "") + "|" + (s.getSectionReference() != null ? s.getSectionReference() : ""));
                    boolean already = mergedSanc.stream().anyMatch(x -> normalizeKey((x.getDescription()!=null?x.getDescription():"")+"|"+(x.getSectionReference()!=null?x.getSectionReference():"")).equals(k2));
                    if (!already) mergedSanc.add(s);
                }
            }
        }
        // prefer r1 instrument fields, fallback to r2
        return ClassificationResult.builder()
            .actName(firstNonBlank(r1.getActName(), r2.getActName()))
            .areaOfFocus(firstNonBlank(r1.getAreaOfFocus(), r2.getAreaOfFocus()))
            .nature(firstNonBlank(r1.getNature(), r2.getNature()))
            .riskRating(firstNonBlank(r1.getRiskRating(), r2.getRiskRating()))
            .riskRatingExplanation(firstNonBlank(r1.getRiskRatingExplanation(), r2.getRiskRatingExplanation()))
            .regulatoryItemType(firstNonBlank(r1.getRegulatoryItemType(), r2.getRegulatoryItemType()))
            .applicabilityToCommercialBanks(firstNonBlank(r1.getApplicabilityToCommercialBanks(), r2.getApplicabilityToCommercialBanks()))
            .licenceTypesApplicable(r1.getLicenceTypesApplicable() != null && !r1.getLicenceTypesApplicable().isEmpty() ? r1.getLicenceTypesApplicable() : r2.getLicenceTypesApplicable())
            .applicabilityConfidence(r1.getApplicabilityConfidence() != null ? r1.getApplicabilityConfidence() : r2.getApplicabilityConfidence())
            .aiSummary(mergeSummary(r1.getAiSummary(), r2.getAiSummary()))
            .referenceNumber(firstNonBlank(r1.getReferenceNumber(), r2.getReferenceNumber()))
            .regulator(firstNonBlank(r1.getRegulator(), r2.getRegulator()))
            .dateOfIssue(firstNonBlank(r1.getDateOfIssue(), r2.getDateOfIssue()))
            .dateOfCommencement(firstNonBlank(r1.getDateOfCommencement(), r2.getDateOfCommencement()))
            .obligations(mergedObs)
            .sanctions(mergedSanc)
            .build();
    }

    private String mergeSummary(String a, String b) {
        if (a == null || a.isBlank()) return b;
        if (b == null || b.isBlank()) return a;
        if (a.contains(b) || b.contains(a)) return a.length() >= b.length() ? a : b;
        return a + " " + b;
    }

    private String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        return b;
    }

    private String normalizeKey(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "").trim();
    }

    @Transactional
    protected void applyClassification(Long instrumentId, ClassificationResult r, String ocrText) {
        try {
            Instrument inst = instruments.findById(instrumentId)
                .orElseThrow(() -> new RuntimeException("Instrument not found: " + instrumentId));
            if (r.getAreaOfFocus() != null && !r.getAreaOfFocus().isBlank()) inst.setAreaOfFocus(shorten(TextCleaner.stripMarkdown(r.getAreaOfFocus()), 255));
            if (r.getNature() != null && !r.getNature().isBlank()) inst.setNature(shorten(normalizeNature(r.getNature()), 50));
            if (r.getRiskRating() != null && !r.getRiskRating().isBlank()) inst.setRiskRating(shorten(normalizeRisk(r.getRiskRating()), 20));
            if (r.getLicenceTypesApplicable() != null) inst.setLicenceTypesApplicable(r.getLicenceTypesApplicable());
            if (r.getApplicabilityConfidence() != null) inst.setApplicabilityConfidence(r.getApplicabilityConfidence());
            if (r.getAiSummary() != null && !r.getAiSummary().isBlank()) inst.setAiSummary(TextCleaner.stripMarkdown(r.getAiSummary()));

            // instrument extensions
            if (r.getRiskRatingExplanation() != null && !r.getRiskRatingExplanation().isBlank())
                inst.setRiskRatingExplanation(TextCleaner.stripMarkdown(r.getRiskRatingExplanation()));
            if (r.getRegulatoryItemType() != null && !r.getRegulatoryItemType().isBlank())
                inst.setRegulatoryItemType(shorten(TextCleaner.stripMarkdown(r.getRegulatoryItemType()), 100));
            if (r.getApplicabilityToCommercialBanks() != null && !r.getApplicabilityToCommercialBanks().isBlank())
                inst.setApplicabilityToCommercialBanks(normalizeYesNo(r.getApplicabilityToCommercialBanks()));
            if (r.getDateOfIssue() != null && !r.getDateOfIssue().isBlank()) {
                LocalDate d = parseDate(r.getDateOfIssue());
                if (d != null) inst.setDateIssued(d);
            }
            if (r.getDateOfCommencement() != null && !r.getDateOfCommencement().isBlank()) {
                LocalDate d = parseDate(r.getDateOfCommencement());
                if (d != null) inst.setDateCommencement(d);
            }

            String ref = r.getReferenceNumber();
            if ((ref == null || ref.isBlank()) && ocrText != null) ref = extractReference(ocrText);
            if (ref != null && !ref.isBlank()) {
                inst.setSourceReferenceNumber(shorten(ref, 255));
            }

            if (inst.getRegulatorId() == null && r.getRegulator() != null && !r.getRegulator().isBlank()) {
                regulators.findByNameContainingIgnoreCase(r.getRegulator())
                    .stream().findFirst()
                    .ifPresent(reg -> inst.setRegulatorId(reg.getRegulatorId()));
            }

            // act_name -> findOrCreateAct + canonical linking
            Long actId = null;
            if (r.getActName() != null && !r.getActName().isBlank()) {
                String actNameClean = TextCleaner.stripMarkdown(r.getActName().trim());
                // shorten act name to 500 for DB column
                actNameClean = shorten(actNameClean, 500);
                actId = findOrCreateAct(actNameClean, inst.getRegulatorId());
                inst.setRegulationId(actId);
                // link canonical if missing
                linkCanonicalIfNeeded(actId, inst.getInstrumentId());
            }

            inst.setStatus(Constants.INST_PUBLISHED);
            instruments.save(inst);

            // obligations
            if (r.getObligations() != null && !r.getObligations().isEmpty()) {
                int nextNumber = obligations.findByInstrumentId(instrumentId).stream()
                    .mapToInt(o -> o.getObligationNumber() != null ? o.getObligationNumber() : 0)
                    .max().orElse(0) + 1;
                // if existing zero, fallback to 1; also keep counter for null LLM numbers
                int autoIncrement = nextNumber;
                for (ClassificationResult.ObligationItem o : r.getObligations()) {
                    String rawStatement = o.getStatement();
                    String rawDescription = o.getDescription();
                    String statement = rawStatement != null ? TextCleaner.stripMarkdown(rawStatement.trim()) : null;
                    if (statement != null && statement.length() > 250) statement = shorten(statement, 250);
                    String verbatim = rawDescription != null ? TextCleaner.stripMarkdown(rawDescription.trim()) : null;
                    if (verbatim != null && verbatim.length() > 500) verbatim = shorten(verbatim, 500);
                    // fallback: if statement blank use verbatim
                    if ((statement == null || statement.isBlank()) && verbatim != null && !verbatim.isBlank()) statement = verbatim;
                    if (statement == null || statement.isBlank()) continue;

                    String title = o.getTitle() != null ? shorten(TextCleaner.stripMarkdown(o.getTitle().trim()), 500) : null;
                    String sectionRef = shorten(o.getSectionReference(), 100);
                    String area = o.getAreaOfFocus() != null && !o.getAreaOfFocus().isBlank() ? shorten(TextCleaner.stripMarkdown(o.getAreaOfFocus()), 100) : inst.getAreaOfFocus();
                    String type = shorten(o.getType(), 100);
                    String deadline = shorten(o.getRecurringDeadline(), 50);
                    String riskDesc = o.getRiskDescription() != null ? TextCleaner.stripMarkdown(o.getRiskDescription()) : null;
                    String likelihood = normalizeRiskLabel(o.getLikelihood());
                    String impact = normalizeRiskLabel(o.getImpact());
                    String riskBand = computeRiskBand(likelihood, impact);
                    String controlOwner = o.getControlOwner() != null ? TextCleaner.stripMarkdown(o.getControlOwner().trim()) : null;

                    Integer number = o.getNumber();
                    if (number == null) number = autoIncrement++;

                    Long obligationRegulationId = actId != null ? actId : inst.getRegulationId();

                    // dedup checks
                    boolean dup = false;
                    try {
                        if (obligations.existsByInstrumentIdAndPlainEnglishStatement(instrumentId, statement)) dup = true;
                        else if (obligationRegulationId != null && sectionRef != null && obligations.existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(obligationRegulationId, statement, sectionRef)) dup = true;
                        else if (obligationRegulationId != null && obligations.existsByInstrumentIdAndPlainEnglishStatementAndSpecificSectionReference(instrumentId, statement, sectionRef)) dup = true;
                    } catch (Throwable ignored) {}
                    if (dup) {
                        log.debug("Skipping duplicate obligation for instrument {}: {}...", instrumentId, statement.substring(0, Math.min(60, statement.length())));
                        continue;
                    }

                    ObligationMapping mapping = ObligationMapping.builder()
                        .instrumentId(instrumentId)
                        .regulationId(obligationRegulationId)
                        .obligationNumber(number)
                        .title(title)
                        .description(verbatim)
                        .plainEnglishStatement(statement)
                        .specificSectionReference(sectionRef)
                        .areaOfFocus(area)
                        .obligationType(type)
                        .recurringDeadlineType(deadline)
                        .riskDescription(riskDesc)
                        .inherentLikelihood(likelihood)
                        .inherentImpact(impact)
                        .inherentRiskRating(riskBand)
                        .controlOwner(controlOwner)
                        .build();
                    obligations.save(mapping);
                }
            }

            // sanctions
            if (r.getSanctions() != null && !r.getSanctions().isEmpty()) {
                for (ClassificationResult.SanctionItem s : r.getSanctions()) {
                    String desc = s.getDescription() != null ? TextCleaner.stripMarkdown(s.getDescription().trim()) : null;
                    if (desc == null || desc.isBlank()) continue;
                    String section = shorten(firstNonBlank(s.getSectionReference(), s.getSourceSectionReference()), 255);
                    String penaltyDetails = s.getPenaltyDetails() != null ? s.getPenaltyDetails().trim() : null;
                    String riskExp = s.getRiskExplanation() != null ? TextCleaner.stripMarkdown(s.getRiskExplanation().trim()) : null;
                    String sanctionType = s.getSanctionType() != null && !s.getSanctionType().isBlank() ? shorten(s.getSanctionType(), 100) : "Regulatory";
                    List<String> roles = s.getLiableRoles();
                    if ((roles == null || roles.isEmpty()) && penaltyDetails != null) {
                        // attempt to extract roles from penaltyDetails if looks like role list
                        roles = splitRoles(penaltyDetails);
                        if (roles != null && roles.size() <= 1 && penaltyDetails.contains("₦")) roles = null;
                    }
                    Long sanctionRegulationId = actId != null ? actId : inst.getRegulationId();
                    String amountStr = s.getSanctionAmount() != null ? s.getSanctionAmount() : penaltyDetails;
                    BigDecimal amount = parseMoney(amountStr);

                    boolean dup = false;
                    try {
                        if (sanctionRegulationId != null && penaltyDetails != null) {
                            dup = sanctionsRepo.existsByRegulationIdAndSourceSectionReferenceAndDescriptionAndPenaltyDetails(sanctionRegulationId, section, desc, penaltyDetails);
                        } else if (sanctionRegulationId != null) {
                            dup = sanctionsRepo.existsByRegulationIdAndSourceSectionReferenceAndDescription(sanctionRegulationId, section, desc);
                        } else {
                            // no regulation id, check by instrument
                            dup = sanctionsRepo.findByInstrumentId(instrumentId).stream()
                                .anyMatch(x -> desc.equalsIgnoreCase(x.getDescription()) && Objects.equals(section, x.getSourceSectionReference()));
                        }
                    } catch (Throwable ignored) {}
                    if (dup) {
                        log.debug("Skipping duplicate sanction for instrument {}: {}...", instrumentId, desc.substring(0, Math.min(60, desc.length())));
                        continue;
                    }
                    SanctionsPenalty penalty = SanctionsPenalty.builder()
                        .instrumentId(instrumentId)
                        .regulationId(sanctionRegulationId)
                        .sanctionType(sanctionType)
                        .description(desc)
                        .sourceSectionReference(section)
                        .sanctionAmountNaira(amount)
                        .penaltyDetails(penaltyDetails)
                        .riskExplanation(riskExp)
                        .liableRoles(roles)
                        .hasBeenEnforced(false)
                        .build();
                    sanctionsRepo.save(penalty);
                }
            }

        } catch (Throwable e) {
            log.error("applyClassification failed for instrument {}: {}", instrumentId, e.getMessage(), e);
            try { if (em != null) em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
        }
    }

    private void linkCanonicalIfNeeded(Long actId, Long instrumentId) {
        if (actId == null || instrumentId == null) return;
        try {
            Regulation reg = actRepo.findById(actId).orElse(null);
            if (reg != null && reg.getCanonicalInstrumentId() == null) {
                reg.setCanonicalInstrumentId(instrumentId);
                actRepo.save(reg);
            } else if (reg != null && reg.getRegulatorId() == null) {
                Instrument inst = instruments.findById(instrumentId).orElse(null);
                if (inst != null && inst.getRegulatorId() != null) {
                    reg.setRegulatorId(inst.getRegulatorId());
                    actRepo.save(reg);
                }
            }
        } catch (Throwable ex) {
            log.warn("linkCanonicalIfNeeded failed for act {} instrument {}: {}", actId, instrumentId, ex.getMessage());
        }
    }

    private Long findOrCreateAct(String title, Integer regulatorId) {
        if (title == null || title.isBlank()) return null;
        if (title.length() > 500) {
            log.warn("[Classification] Act name too long ({} chars): {}", title.length(), title.substring(0, Math.min(250, title.length())));
            title = title.substring(0, 500);
        }
        String normalizedKey = normalize(title);
        // alias
        try {
            Optional<RegulationAlias> alias = aliasRepo.findByAlias(normalizedKey);
            if (alias.isPresent()) {
                Regulation reg = actRepo.findById(alias.get().getRegulationId()).orElse(null);
                if (reg != null) return reg.getRegulationId();
            }
        } catch (Throwable ignored) {}
        // exact name
        var byTitle = actRepo.findByName(title);
        if (byTitle.isPresent()) return byTitle.get().getRegulationId();
        // normalized match
        try {
            Optional<Regulation> byNorm = actRepo.findAll().stream()
                .filter(r -> normalize(r.getName()).equals(normalizedKey))
                .findFirst();
            if (byNorm.isPresent()) return byNorm.get().getRegulationId();
        } catch (Throwable ignored) {}
        Regulation reg = Regulation.builder()
            .name(title)
            .regulatorId(regulatorId)
            .status("Active")
            .build();
        actRepo.save(reg);
        try {
            aliasRepo.save(RegulationAlias.builder().alias(normalizedKey).regulationId(reg.getRegulationId()).build());
        } catch (Throwable e) {
            log.warn("[Classification] Alias save failed ({}): {}", normalizedKey, e.getMessage());
        }
        return reg.getRegulationId();
    }

    /**
     * Regex fallback: pulls a CBN-style document reference out of the OCR text when the AI
     * does not return one. Matches patterns like FPR/DIR/CIR/GEN/01/011 or BSD/DIR/GEN/LAB/08/016.
     */
    static String extractReference(String text) {
        if (text == null || text.isBlank()) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(
            "\\b[A-Z]{2,6}/DIR/[A-Z/0-9]+", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(text);
        if (m.find()) return m.group().trim();
        return null;
    }

    private String shorten(String s, int max) {
        if (s == null || s.length() <= max) return s;
        return s.substring(0, max);
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "").trim();
    }

    // ── Toolkit helpers copied for classifier parity ──
    private String normalizeRisk(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT);
        if (v.contains("high")) return "High";
        if (v.contains("medium")) return "Medium";
        if (v.contains("low")) return "Low";
        return null;
    }

    private String normalizeNature(String s) {
        if (s == null) return null;
        String v = s.toLowerCase(Locale.ROOT);
        if (v.contains("core")) return "Core";
        if (v.contains("topical") || v.contains("pertinent")) return "Topical/Pertinent";
        if (v.contains("secondary")) return "Secondary";
        if (v.contains("other")) return "Others";
        if (v.contains("guidance")) return "Guidance";
        return s;
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

    private static final DateTimeFormatter[] DATE_FORMATS = {
        DateTimeFormatter.ISO_LOCAL_DATE,
        new DateTimeFormatterBuilder().appendPattern("dd/MM/yyyy").toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("MMMM d, yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("MMM d, yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("d MMMM yyyy").parseLenient().toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("yyyy-MM-dd HH:mm:ss").toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("dd-MM-yyyy").toFormatter(),
        new DateTimeFormatterBuilder().appendPattern("yyyy/MM/dd").toFormatter()
    };

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String clean = s.trim().replace("00:00:00", "").trim();
        if (clean.isEmpty()) return null;
        for (DateTimeFormatter f : DATE_FORMATS) {
            try { return LocalDate.parse(clean, f); } catch (Exception ignored) { }
        }
        // try extracting ISO date inside string
        try {
            Matcher m = Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(clean);
            if (m.find()) return LocalDate.parse(m.group(1), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception ignored) {}
        return null;
    }

    private BigDecimal parseMoney(String s) {
        if (s == null || s.isBlank()) return null;
        BigDecimal largest = null;
        for (String token : s.split("[,\\s]+")) {
            if (token.isBlank()) continue;
            BigDecimal v = parseMoneyToken(token);
            if (v != null && (largest == null || v.compareTo(largest) > 0)) largest = v;
        }
        if (largest == null) return null;
        if (largest.compareTo(new BigDecimal("9999999999999.99")) > 0) {
            log.warn("[Classification] Sanction amount too large, skipping value: {}", s);
            return null;
        }
        return largest;
    }

    private static final Pattern MONEY_TOKEN = Pattern.compile("(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*([mMkK])?");
    private static final BigDecimal ONE_MILLION = new BigDecimal("1000000");
    private static final BigDecimal ONE_THOUSAND = new BigDecimal("1000");

    private BigDecimal parseMoneyToken(String token) {
        Matcher m = MONEY_TOKEN.matcher(token);
        if (!m.find()) return null;
        String raw = m.group(1).replace(",", "");
        BigDecimal v;
        try { v = new BigDecimal(raw); } catch (Exception e) { return null; }
        String suffix = m.group(2);
        if (suffix != null) {
            if (suffix.equalsIgnoreCase("m")) v = v.multiply(ONE_MILLION);
            else if (suffix.equalsIgnoreCase("k")) v = v.multiply(ONE_THOUSAND);
        }
        return v;
    }

    private List<String> splitRoles(String s) {
        if (s == null || s.isBlank()) return null;
        List<String> parts = Arrays.stream(s.split(","))
            .map(String::trim)
            .filter(x -> !x.isBlank())
            .toList();
        return parts.isEmpty() ? null : parts;
    }
}
