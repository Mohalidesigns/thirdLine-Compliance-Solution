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
    @Builder.Default
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
    private Integer assignedOwnerId;
    private Integer assignedTeamId;
    private Integer assignedDepartmentId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Integer> linkedControlIds;
    @Builder.Default
    private Boolean hasGap = false;
    @Column(columnDefinition = "text")
    private String gapDescription;
    @Builder.Default
    private Integer classificationVersion = 1;
    private Integer classifiedByUserId;
    private Instant classifiedAt;
    @Builder.Default
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
        computeInherentRisk(null, null);
    }

    public void computeInherentRisk(java.util.List<String> impactLevels, java.util.List<String> likelihoodLevels) {
        if (impactRating == null || likelihoodRating == null) {
            this.inherentRiskRating = null;
            return;
        }
        java.util.List<String> impacts = impactLevels != null ? impactLevels
            : java.util.List.of("Insignificant", "Minor", "Moderate", "Major", "Severe");
        java.util.List<String> likelihoods = likelihoodLevels != null ? likelihoodLevels
            : java.util.List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");

        int impactIdx = impacts.indexOf(impactRating) + 1;
        int likelihoodIdx = likelihoods.indexOf(likelihoodRating) + 1;
        if (impactIdx == 0 || likelihoodIdx == 0) { this.inherentRiskRating = null; return; }

        int score = impactIdx * likelihoodIdx;
        if (score >= 18) this.inherentRiskRating = "Critical";
        else if (score >= 12) this.inherentRiskRating = "High";
        else if (score >= 6) this.inherentRiskRating = "Moderate";
        else this.inherentRiskRating = "Low";
    }

    public static String computeResidualRisk(String inherentRisk, boolean controlsLinked, String testStatus) {
        if (inherentRisk == null) return null;
        if (!controlsLinked || testStatus == null) return inherentRisk;
        return switch (testStatus) {
            case "Passed" -> switch (inherentRisk) {
                case "Critical" -> "High"; case "High" -> "Moderate";
                case "Moderate" -> "Low";  default -> "Low";
            };
            case "Failed" -> inherentRisk;
            default -> inherentRisk;
        };
    }
}
