package com.atheris.compliance.tenant.backend.shared.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformRegulationSeed {

    private Long regulationId;
    private String regulationName;
    private String regulationAbbreviation;
    private Integer regulatorId;
    private String regulatorName;
    private String regulatorAbbreviation;

    private InstrumentItem canonicalInstrument;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;
    private List<ReturnItem> returns;
    private List<ControlItem> controls;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class InstrumentItem {
        private Long instrumentId;
        private String sourceTitle;
        private String sourceReferenceNumber;
        private LocalDate dateIssued;
        private LocalDate dateCommencement;
        private String riskRating;
        private String nature;
        private String areaOfFocus;
        private String aiSummary;
        private String pdfUrl;
        private LocalDate publishedAt;
        private String status;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObligationItem {
        private Integer obligationNumber;
        private String plainEnglishStatement;
        private String specificSectionReference;
        private String areaOfFocus;
        private String obligationType;
        private String recurringDeadlineType;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal sanctionAmountNaira;
        private Boolean sanctionAmountPerDay;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
        private String description;
        private String sourceSectionReference;
        private String riskExplanation;
        private String penaltyDetails;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReturnItem {
        private String title;
        private String sectionReference;
        private String statutoryBasis;
        private String responsibleUnit;
        private String responsiblePerson;
        private String frequency;
        private String frequencyType;
        private String deadline;
        private LocalDate filingDate;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ControlItem {
        private String controlNumber;
        private String theme;
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
        private String actName;
        private Long obligationId;
    }
}