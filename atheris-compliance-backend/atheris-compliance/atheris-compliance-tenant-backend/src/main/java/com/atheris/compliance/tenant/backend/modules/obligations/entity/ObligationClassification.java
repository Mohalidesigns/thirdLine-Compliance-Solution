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
        this.inherentRiskRating = inherentBand(impactRating, likelihoodRating, impactLevels, likelihoodLevels);
    }

    /** Canonical impact axis, lowest to highest (what {@link #inherentBand} scores). */
    public static final java.util.List<String> IMPACT_LEVELS =
        java.util.List.of("Insignificant", "Minor", "Moderate", "Major", "Severe");
    /** Canonical likelihood axis, lowest to highest. */
    public static final java.util.List<String> LIKELIHOOD_LEVELS =
        java.util.List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");

    /** Inherent risk band on the canonical axes, or null when either rating is missing/unknown. */
    public static String inherentBand(String impact, String likelihood) {
        return inherentBand(impact, likelihood, null, null);
    }

    public static String inherentBand(String impact, String likelihood,
                                      java.util.List<String> impactLevels, java.util.List<String> likelihoodLevels) {
        if (impact == null || likelihood == null) return null;
        java.util.List<String> impacts = impactLevels != null ? impactLevels : IMPACT_LEVELS;
        java.util.List<String> likelihoods = likelihoodLevels != null ? likelihoodLevels : LIKELIHOOD_LEVELS;

        int impactIdx = impacts.indexOf(impact) + 1;
        int likelihoodIdx = likelihoods.indexOf(likelihood) + 1;
        if (impactIdx == 0 || likelihoodIdx == 0) return null;

        int score = impactIdx * likelihoodIdx;
        if (score >= 18) return "Critical";
        if (score >= 12) return "High";
        if (score >= 6) return "Moderate";
        return "Low";
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
