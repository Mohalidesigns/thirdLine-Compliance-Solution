package com.atheris.compliance.tenant.backend.modules.review.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "pending_reviews")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PendingReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reviewId;
    @Column(nullable = false) private Long tenantId;
    @Builder.Default private String source = "intel";
    private Long instrumentId;
    private UUID uploadId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private Integer regulatorId;
    private String regulatorName;
    private String regulatorAbbreviation;
    private String documentType;
    private String riskRating;
    private LocalDate dateIssued;
    private LocalDate effectiveDate;
    private LocalDate publishedAt;
    @Column(length = 500) private String pdfUrl;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "obligations_json", columnDefinition = "jsonb")
    private List<ReviewObligation> obligations;
    @Builder.Default private String status = "pending";
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
