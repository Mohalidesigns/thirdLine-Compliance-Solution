package com.atheris.tenant.modules.notifications.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "obligation_notifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ObligationNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long notificationId;
    @Column(nullable = false)
    private Long instrumentId;
    private String changeType;
    private String changeSeverity;
    @Column(columnDefinition = "text")
    private String changeSummary;
    @Column(columnDefinition = "text")
    private String changedFields;
    private String status = "unread";
    private Integer acknowledgedByUserId;
    private Instant readAt;
    private Instant acknowledgedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
