package com.atheris.compliance.tenant.backend.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "controls")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Control {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer controlId;
    @Column(nullable = false, unique = true)
    private String controlNumber;
    @Column(nullable = false, columnDefinition = "text")
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    private String theme;
    private String controlType;
    @Column(columnDefinition = "text")
    private String whatItDoes;
    @Column(columnDefinition = "text")
    private String howTested;
    private Integer controlOwnerUserId;
    private String controlOwnerName;
    private Integer controlOwnerId;
    private String testFrequency;
    private Integer testFrequencyDays;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Long> linkedObligationIds;
    @Column(columnDefinition = "text")
    private String regulatoryRequirement;
    private String complianceArea;
    @Column(columnDefinition = "text")
    private String monitoringActivity;
    private String dueDate;
    @Column(columnDefinition = "text")
    private String controlEffectivenessMeasure;
    private Integer actId;
    @Column(columnDefinition = "text")
    private String actName;
    private Long obligationId;
    private String inherentRisk;
    private String residualRisk;
    private String residualLikelihood;
    private String residualImpact;
    private String residualRiskRating;
    @Column(columnDefinition = "text") private String ownerName;
    @Builder.Default
    private String status = "Active";
    private Integer createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
