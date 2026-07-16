package com.atheris.compliance.intelligence.backend.modules.classification.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.classification.dto.ClassificationResult;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.jobs.service.JobQueueService;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.shared.ai.AiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service @Slf4j @RequiredArgsConstructor
public class ClassificationService {

    private final AiClient aiClient;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final JobQueueService jobQueue;
    private final ObjectMapper mapper;

    private static final String PROMPT = """
        You are a Nigerian financial regulatory compliance expert.
        Analyse the regulatory document text and return ONLY valid JSON with these fields:
        {
          "area_of_focus": string (one of: AML/CFT, Corporate Governance, Cash Management,
            Data Protection, Consumer Protection, Cybersecurity, ABAC, ESG, Capital Market,
            Account Management, Financial Reporting, Conduct Risk),
          "nature": "Core" | "Secondary" | "Guidance",
          "risk_rating": "High" | "Medium" | "Low",
          "licence_types_applicable": string[],
          "applicability_confidence": number (0.0 to 1.0),
          "ai_summary": string (3-5 plain English sentences),
          "obligations": [
            {
              "number": integer,
              "statement": string,
              "section_reference": string,
              "type": "Operational" | "Reporting" | "Governance" | "One-time",
              "recurring_deadline": "Continuous" | "Monthly" | "Quarterly" | "Annual" | "One-time"
            }
          ]
        }
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
            applyClassification(instrumentId, result);
            jobQueue.enqueue(Constants.JOB_APPLICABILITY, instrumentId,
                Map.of("instrument_id", instrumentId), "classifier");
            log.info("Classified instrument {}: {} / {}", instrumentId,
                result.getAreaOfFocus(), result.getRiskRating());
        } catch (Exception e) {
            log.error("Classification failed for instrument {}: {}", instrumentId, e.getMessage());
            throw new RuntimeException(e);
        }
    }

    public ClassificationResult classifySync(Long instrumentId, String ocrText) {
        ClassificationResult result = callLLm(ocrText);
        applyClassification(instrumentId, result);
        return result;
    }

    private ClassificationResult callLLm(String ocrText) {
        String truncated = ocrText.substring(0, Math.min(80_000, ocrText.length()));
        String prompt = PROMPT.formatted(truncated);
        String response = aiClient.complete(prompt);
        try {
            String clean = response.replaceAll("```json|```", "").trim();
            return mapper.readValue(clean, ClassificationResult.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI response: " + e.getMessage(), e);
        }
    }

    private void applyClassification(Long instrumentId, ClassificationResult r) {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + instrumentId));
        inst.setAreaOfFocus(r.getAreaOfFocus());
        inst.setNature(r.getNature());
        inst.setRiskRating(r.getRiskRating());
        inst.setLicenceTypesApplicable(r.getLicenceTypesApplicable());
        inst.setApplicabilityConfidence(r.getApplicabilityConfidence());
        inst.setAiSummary(r.getAiSummary());
        inst.setStatus(Constants.INST_PUBLISHED);
        instruments.save(inst);

        if (r.getObligations() != null) {
            r.getObligations().forEach(o -> obligations.save(
                ObligationMapping.builder()
                    .instrumentId(instrumentId)
                    .obligationNumber(o.getNumber())
                    .plainEnglishStatement(o.getStatement())
                    .specificSectionReference(o.getSectionReference())
                    .obligationType(o.getType())
                    .recurringDeadlineType(o.getRecurringDeadline())
                    .build()
            ));
        }
    }
}
