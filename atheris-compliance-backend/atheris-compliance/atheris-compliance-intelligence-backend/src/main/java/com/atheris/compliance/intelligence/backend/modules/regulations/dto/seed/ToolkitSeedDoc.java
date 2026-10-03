package com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Typed document model for toolkit/compliance_toolkits.json — the committed, pre-parsed
 * toolkit seed produced by tools/toolkit-md-points/export_json.py.
 *
 * The importer consumes these nested rows instead of re-parsing the markdown tables.
 * Rows are emitted verbatim (duplicate obligation rows included); the importer keeps its
 * existsBy dedup and the single global control-number sequence, so fresh-import DB parity
 * (1541 obligations / 597 sanctions / 139 returns / 363 universe / 192 CMP) is preserved
 * by construction.
 */
@Data @JsonIgnoreProperties(ignoreUnknown = true)
public class ToolkitSeedDoc {

    private Meta meta;
    private List<Universe> universe;
    private List<UniverseSanction> universeSanctions;
    private Map<String, List<ObligationRow>> obligations;
    private List<SanctionsRow> sanctions;
    private List<ReturnsRow> returns;
    private List<MonitoringRow> monitoringPlan;

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Meta {
        private String generator;
        private String generatedFrom;
        private String generatedAt;
        private Boolean dedupApplied;
        private Map<String, Object> totals;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Universe {
        private String title;
        private String reference;
        private String description;
        private String dateIssued;
        private String dateCommencement;
        private String regulatoryBody;
        private String type;
        private String nature;
        private String areaOfFocus;
        private String sanctions;
        private String status;
        private String commentOnStatus;
        private String documentUrl;
        private String riskRating;
        private String riskRatingExplanation;
        private String commercialBankRelevance;
        private String commercialBankComplianceContext;
        private String applicabilityToCommercialBanks;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UniverseSanction {
        private String regulation;
        private String violation;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ObligationRow {
        private String source;
        private String sectionRef;
        private String title;
        private String description;
        private String plain;
        private String obligationType;
        private String deadlineType;
        private String riskDescription;
        private String likelihoodInherent;
        private String impactInherent;
        private String owner;
        private String responsibility;
        private String primaryControl;
        private String additionalControl;
        private String residualLikelihood;
        private String residualImpact;
        private String status;
        private List<Map<String, Object>> points;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SanctionsRow {
        private String regulation;
        private String sectionRef;
        private String violation;
        private String penalty;
        private String riskExplanation;
        private String liableRoles;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReturnsRow {
        private String act;
        private String title;
        private String sectionRef;
        private String description;
        private String frequency;
        private String responsibleUnit;
        private String responsiblePerson;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MonitoringRow {
        private String theme;
        private String controlNumber;
        private String regulatoryRequirement;
        private String complianceArea;
        private String riskLevel;
        private String complianceControl;
        private String monitoringActivity;
        private String frequency;
        private String responsibleOfficer;
        private String dueDate;
        private String status;
        private String controlEffectivenessMeasure;
    }
}
