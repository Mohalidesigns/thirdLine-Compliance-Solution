package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UploadReviewResponse {
    private UUID uploadId;
    private Long platformInstrumentId;
    private String status;
    private Integer regulatorId;
    private String regulatorName;
    private String pdfUrl;
    private String pdfOcrText;
    private String aiSummary;
    private List<ObligationItem> obligations;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObligationItem {
        private Integer obligationNumber;
        private String plainEnglishStatement;
        private String specificSectionReference;
        private String obligationType;
        private String recurringDeadlineType;
    }
}
