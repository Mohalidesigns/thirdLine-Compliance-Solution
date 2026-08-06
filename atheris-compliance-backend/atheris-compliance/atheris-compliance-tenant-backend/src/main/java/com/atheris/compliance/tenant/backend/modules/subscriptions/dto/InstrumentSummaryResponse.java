package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InstrumentSummaryResponse {
    private Long id;
    private String sourceTitle;
    private String title;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String riskRating;
    private String status;
    private LocalDate publishedAt;
    private LocalDate createdAt;
    private String pdfUrl;
    private int obligationCount;
}
