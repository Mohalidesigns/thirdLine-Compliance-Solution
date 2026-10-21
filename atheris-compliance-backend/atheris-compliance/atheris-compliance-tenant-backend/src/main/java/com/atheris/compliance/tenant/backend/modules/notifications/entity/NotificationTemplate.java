package com.atheris.compliance.tenant.backend.modules.notifications.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "notification_templates")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long templateId;

    @Column(nullable = false, unique = true, length = 100)
    private String templateKey;

    @Builder.Default
    @Column(length = 20)
    private String channel = "EMAIL";

    @Column(length = 500)
    private String subject;

    @Column(columnDefinition = "text")
    private String body;

    @Builder.Default
    private Boolean ccOwner = true;

    @Builder.Default
    private Boolean isActive = true;

    private Integer updatedByUserId;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
