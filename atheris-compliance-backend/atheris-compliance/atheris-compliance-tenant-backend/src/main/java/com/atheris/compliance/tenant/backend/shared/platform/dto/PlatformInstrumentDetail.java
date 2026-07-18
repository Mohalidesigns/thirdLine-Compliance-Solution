package com.atheris.compliance.tenant.backend.shared.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformInstrumentDetail {
    private Long instrumentId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private Integer regulatorId;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String riskRating;
    private String nature;
    private String areaOfFocus;
    private String aiSummary;
    private String pdfUrl;
    private String pdfOcrText;
    private LocalDate publishedAt;
    private String status;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObligationItem {
        private Integer obligationNumber;
        private String plainEnglishStatement;
        private String specificSectionReference;
        private String obligationType;
        private String recurringDeadlineType;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal amountNaira;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
    }

    public boolean isCompleted() {
        return "Published".equals(status) || "completed".equals(status);
    }
}
