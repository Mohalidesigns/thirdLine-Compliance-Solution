package com.atheris.compliance.intelligence.backend.modules.internal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InternalInstrumentSummary {
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
