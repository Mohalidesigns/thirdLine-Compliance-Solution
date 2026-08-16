package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class RegulationDetailDto {
    private Long regulationId;
    private String name;
    private String abbreviation;
    private String description;
    private Integer regulatorId;
    private String regulatorName;
    private String status;
    private int instrumentCount;
    private int obligationCount;
    private int sanctionCount;
    private int returnCount;
    private List<InstrumentItem> instruments;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;
    private List<ReturnItem> returns;

    @Data @Builder
    public static class InstrumentItem {
        private Long instrumentId;
        private String sourceTitle;
        private String nature;
        private String areaOfFocus;
        private String riskRating;
        private LocalDate dateIssued;
        private String status;
        private boolean hasPdf;
        private String documentUrl;
    }

    @Data @Builder
    public static class ObligationItem {
        private Long obligationId;
        private String sectionReference;
        private String statement;
        private String type;
        private String recurringDeadline;
    }

    @Data @Builder
    public static class SanctionItem {
        private Long sanctionId;
        private String sanctionType;
        private BigDecimal amountNaira;
        private Boolean amountPerDay;
        private List<String> liableRoles;
        private String description;
        private String sectionReference;
        private String riskExplanation;
        private String penaltyDetails;
    }

    @Data @Builder
    public static class ReturnItem {
        private Long returnId;
        private String title;
        private String sectionReference;
        private String statutoryBasis;
        private String recipient;
        private String frequency;
        private String deadline;
    }
}