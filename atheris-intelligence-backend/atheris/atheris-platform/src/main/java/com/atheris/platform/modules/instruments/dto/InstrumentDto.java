package com.atheris.platform.modules.instruments.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class InstrumentDto {
    private Long instrumentId;
    private Integer regulatorId;
    private String sourceTitle;
    private String areaOfFocus;
    private String nature;
    private String riskRating;
    private Double applicabilityConfidence;
    private String aiSummary;
    private List<String> licenceTypesApplicable;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;
    private Instant discoveredAt;
    private Instant firstPublishedAt;
}
