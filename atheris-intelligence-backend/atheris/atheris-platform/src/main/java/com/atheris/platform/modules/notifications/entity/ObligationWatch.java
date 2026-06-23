package com.atheris.platform.modules.notifications.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "obligation_watches",
    uniqueConstraints = @UniqueConstraint(columnNames = {"instrument_id", "tenant_id"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationWatch {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long watchId;
    @Column(nullable = false) private Long instrumentId;
    @Column(nullable = false) private String tenantId;
    private String classification;   // applicable | not_applicable | under_review
    private Instant classifiedAt;
    private Integer classifiedByUserId;
    private Boolean isWatching = true;
    private Boolean notifyEmail = true;
    private Boolean notifyInApp = true;
    private Boolean notifyWebhook = true;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
