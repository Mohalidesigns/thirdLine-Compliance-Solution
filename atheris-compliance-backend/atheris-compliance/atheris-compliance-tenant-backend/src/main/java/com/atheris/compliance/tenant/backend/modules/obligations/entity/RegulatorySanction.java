package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "regulatory_sanctions", indexes = {
    @Index(name = "idx_reg_sanctions_instrument", columnList = "instrumentId")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatorySanction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sanctionId;
    private Long instrumentId;
    @Column(name = "act_id") private Long regulationId;
    @Column(name = "act_name", length = 500) private String regulationName;
    @Column(name = "act_abbreviation", length = 50) private String actAbbreviation;
    @Column(length = 100) private String sanctionType;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "penalty_type", columnDefinition = "jsonb")
    private List<String> penaltyType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    private BigDecimal personalLiabilityNaira;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> liableRoles;
    private Integer severityScore;
    @Builder.Default
    private Boolean hasBeenEnforced = false;
    private LocalDate recentEnforcementDate;
    private BigDecimal recentEnforcementAmount;
    @Column(columnDefinition = "text") private String description;
    @Column(length = 255) private String sourceSectionReference;
    @Column(columnDefinition = "text") private String riskExplanation;
    @Column(columnDefinition = "text") private String penaltyDetails;
    @Column(name = "instrument_title", columnDefinition = "text") private String instrumentTitle;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
