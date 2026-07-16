package com.atheris.compliance.intelligence.backend.modules.sanctions.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Entity @Table(name = "sanctions_and_penalties")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SanctionsPenalty {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sanctionId;
    @Column(nullable = false) private Long instrumentId;
    private String sanctionType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> liableRoles;
    private BigDecimal personalLiabilityNaira;
    private Integer severityScore;
    private Boolean hasBeenEnforced = false;
    private LocalDate recentEnforcementDate;
    private BigDecimal recentEnforcementAmount;
    @Column(columnDefinition = "text") private String description;
    private String sourceSectionReference;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
