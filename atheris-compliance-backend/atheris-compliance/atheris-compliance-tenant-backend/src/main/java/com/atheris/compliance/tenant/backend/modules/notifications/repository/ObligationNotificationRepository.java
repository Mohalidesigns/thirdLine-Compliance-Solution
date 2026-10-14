package com.atheris.compliance.tenant.backend.modules.notifications.repository;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.ObligationNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ObligationNotificationRepository extends JpaRepository<ObligationNotification, Long>, JpaSpecificationExecutor<ObligationNotification> {
    List<ObligationNotification> findByStatusOrderByCreatedAtDesc(String status);
    List<ObligationNotification> findByChangeSeverityAndStatus(String severity, String status);
    long countByStatus(String status);
    long countByChangeSeverityAndStatus(String severity, String status);

    /** Everything addressed to one user, newest first. */
    List<ObligationNotification> findByRecipientUserIdOrderByCreatedAtDesc(Integer recipientUserId);
    /** Unread addressed to one user. */
    List<ObligationNotification> findByRecipientUserIdAndStatusOrderByCreatedAtDesc(Integer recipientUserId, String status);
    /** Unread broadcast to a role (recipient_user_id null). */
    List<ObligationNotification> findByRecipientRoleAndRecipientUserIdIsNullAndStatusOrderByCreatedAtDesc(String recipientRole, String status);
    long countByRecipientUserIdAndStatus(Integer recipientUserId, String status);
    long countByRecipientRoleAndRecipientUserIdIsNullAndStatus(String recipientRole, String status);
    List<ObligationNotification> findByRecipientRoleAndRecipientUserIdIsNullOrderByCreatedAtDesc(String recipientRole);
}