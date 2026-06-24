package com.atheris.platform.modules.instruments.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class InstrumentDetailDto {
    private Long instrumentId;
    private String sourceTitle;
    private String regulator;
    private String instrumentType;
    private String areaOfFocus;
    private String nature;
    private String riskRating;
    private Double applicabilityConfidence;
    private String aiSummary;
    private List<String> licenceTypesApplicable;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;
    private String pdfUrl;
    private String sourceUrl;
    private String pdfOcrText;
    private Instant discoveredAt;
    private List<ObligationDto> obligations;
    private List<SanctionDto> sanctions;

    @Data @Builder
    public static class ObligationDto {
        private Integer number;
        private String statement;
        private String sectionReference;
        private String type;
        private String recurringDeadline;
    }

    @Data @Builder
    public static class SanctionDto {
        private String sanctionType;
        private java.math.BigDecimal amountNaira;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
    }
}
