package com.atheris.compliance.tenant.backend.modules.review.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.Instant;

@Data @Builder
public class ReviewItem {
    private Long reviewId;
    private String source;
    private Long instrumentId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private String regulatorId;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String riskRating;
    private LocalDate dateIssued;
    private LocalDate publishedAt;
    private String status;
    private int obligationCount;
    private Instant createdAt;
}
