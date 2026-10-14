package com.atheris.compliance.tenant.backend.modules.notifications.entity;

import jakarta.persistence.*;
import lombok.*;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import java.time.Instant;

/**
 * An in-app notification. It targets either a specific user ({@code recipientUserId})
 * or everyone holding a role ({@code recipientRole}, with {@code recipientUserId} null).
 * The first ten columns mirror the original obligation-change notification; the recipient,
 * category and link columns make it a general-purpose per-user inbox.
 */
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
    private Long instrumentId;
    private Integer recipientUserId;
    private String recipientRole;
    private String category;
    @Column(columnDefinition = "text")
    private String link;
    private String changeType;
    private String changeSeverity;
    @Column(columnDefinition = "text")
    private String changeSummary;
    @Column(columnDefinition = "text")
    private String changedFields;
    @Builder.Default
    private String status = NotificationConstants.STATUS_UNREAD;
    private Integer acknowledgedByUserId;
    private Instant readAt;
    private Instant acknowledgedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}