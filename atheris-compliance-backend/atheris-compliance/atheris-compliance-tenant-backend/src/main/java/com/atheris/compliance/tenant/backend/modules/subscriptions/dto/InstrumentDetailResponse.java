package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InstrumentDetailResponse {
    private Long id;
    private String sourceTitle;
    private String title;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String riskRating;
    private String status;
    private LocalDate publishedAt;
    private String pdfUrl;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObligationItem {
        private Long obligationId;
        private String description;
        private String section;
        private String type;
        private LocalDate effectiveDate;
        private String status;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SanctionItem {
        private String description;
        private String type;
    }
}
