package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
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
    private Long regulationId;
    @Column(length = 500) private String regulationName;
    @Column(length = 100) private String sanctionType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> liableRoles;
    private Integer severityScore;
    @Builder.Default
    private Boolean hasBeenEnforced = false;
    @Column(columnDefinition = "text") private String description;
    @Column(length = 255) private String sourceSectionReference;
    @Column(columnDefinition = "text") private String riskExplanation;
    @Column(columnDefinition = "text") private String penaltyDetails;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
