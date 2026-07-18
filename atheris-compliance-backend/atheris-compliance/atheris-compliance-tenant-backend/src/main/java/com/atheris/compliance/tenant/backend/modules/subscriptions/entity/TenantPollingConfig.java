package com.atheris.compliance.tenant.backend.modules.subscriptions.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "tenant_polling_config")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantPollingConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true) private Long tenantId;
    private Integer pollingIntervalMinutes = 15;
    private Instant lastPolledAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
