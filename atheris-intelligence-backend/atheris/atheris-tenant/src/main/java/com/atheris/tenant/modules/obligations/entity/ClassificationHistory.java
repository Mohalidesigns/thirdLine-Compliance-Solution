package com.atheris.tenant.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "classification_history")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long historyId;
    @Column(nullable = false)
    private Long instrumentId;
    private Integer classificationVersion;
    private String applicability;
    private String tenantRiskRating;
    private Integer assignedOwnerUserId;
    private Boolean hasGap;
    @Column(columnDefinition = "text")
    private String changeReason;
    private Integer changedByUserId;
    private Instant changedAt;

    @PrePersist
    void onCreate() {
        changedAt = Instant.now();
    }
}
