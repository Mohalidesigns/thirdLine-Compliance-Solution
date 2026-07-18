package com.atheris.compliance.tenant.backend.shared.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformInstrumentSummary {
    private Long instrumentId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private Integer regulatorId;
    private LocalDate dateIssued;
    private String riskRating;
    private String nature;
    private String areaOfFocus;
    private String aiSummary;
    private LocalDate publishedAt;
    private String pdfUrl;
}
