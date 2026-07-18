package com.atheris.compliance.tenant.backend.modules.subscriptions.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "tenant_regulators")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantRegulator {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long tenantId;
    @Column(nullable = false) private String name;
    private String abbreviation;
    private Integer platformRegulatorId;
    @Column(columnDefinition = "text") private String description;
    private Boolean isActive = true;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
