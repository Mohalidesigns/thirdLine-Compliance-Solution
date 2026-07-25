package com.atheris.compliance.tenant.backend.modules.obligations.entity;

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
    private Long instrumentId;
    @Column(unique = true)
    private Long obligationId;
    private String applicability = "under_review";
    @Column(columnDefinition = "text")
    private String applicabilityReasoning;
    private String tenantRiskRating;
    @Column(columnDefinition = "text")
    private String riskJustification;
    private String riskType;
    private String impactRating;
    @Column(columnDefinition = "text")
    private String impactJustification;
    private String likelihoodRating;
    @Column(columnDefinition = "text")
    private String likelihoodJustification;
    private String inherentRiskRating;
    private String residualRiskRating;
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
    private String status = "unclassified";
    private String auditHash;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
        classifiedAt = Instant.now();
        computeInherentRisk();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        computeInherentRisk();
    }

    public void computeInherentRisk() {
        if (impactRating == null || likelihoodRating == null) {
            this.inherentRiskRating = null;
            return;
        }
        int impactIdx = switch (impactRating) {
            case "Critical" -> 4; case "High" -> 3;
            case "Medium" -> 2;  case "Low" -> 1;
            default -> 0;
        };
        int likelihoodIdx = switch (likelihoodRating) {
            case "Almost Certain" -> 5; case "Likely" -> 4;
            case "Possible" -> 3;       case "Unlikely" -> 2;
            case "Rare" -> 1;
            default -> 0;
        };
        if (impactIdx == 0 || likelihoodIdx == 0) { this.inherentRiskRating = null; return; }
        int score = impactIdx * likelihoodIdx;
        if (score >= 16) this.inherentRiskRating = "Extreme";
        else if (score >= 9) this.inherentRiskRating = "High";
        else if (score >= 4) this.inherentRiskRating = "Medium";
        else this.inherentRiskRating = "Low";
    }

    public static String computeResidualRisk(String inherentRisk, boolean controlsLinked, String testStatus) {
        if (inherentRisk == null) return null;
        if (!controlsLinked || testStatus == null) return inherentRisk;
        return switch (testStatus) {
            case "Passed" -> switch (inherentRisk) {
                case "Extreme" -> "High"; case "High" -> "Medium";
                case "Medium" -> "Low";   default -> "Low";
            };
            case "Failed" -> inherentRisk;
            default -> inherentRisk;
        };
    }
}
