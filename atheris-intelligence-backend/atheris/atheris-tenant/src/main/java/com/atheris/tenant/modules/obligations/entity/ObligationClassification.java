package com.atheris.tenant.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "obligation_classifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ObligationClassification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long classificationId;
    @Column(nullable = false, unique = true)
    private Long instrumentId;
    private String applicability = "under_review";
    @Column(columnDefinition = "text")
    private String applicabilityReasoning;
    private String tenantRiskRating;
    @Column(columnDefinition = "text")
    private String riskJustification;
    private Integer assignedOwnerUserId;
    private String assignedOwnerName;
    private String assignedDepartment;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Integer> linkedControlIds;
    private Boolean hasGap = false;
    @Column(columnDefinition = "text")
    private String gapDescription;
    private Integer classificationVersion = 1;
    private Integer classifiedByUserId;
    private Instant classifiedAt;
    private Boolean ccoApproved = false;
    private Integer ccoApprovedByUserId;
    private Instant ccoApprovedAt;
    private String status = "unclassified";
    private String auditHash;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
        classifiedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
