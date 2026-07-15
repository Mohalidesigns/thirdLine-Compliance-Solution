package com.atheris.tenant.modules.notifications.repository;

import com.atheris.tenant.modules.notifications.entity.ObligationNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface ObligationNotificationRepository extends JpaRepository<ObligationNotification, Long> {
    List<ObligationNotification> findByStatusOrderByCreatedAtDesc(String status);
    List<ObligationNotification> findByChangeSeverityAndStatus(String severity, String status);
    long countByStatus(String status);

    @Modifying
    @Query(value = "UPDATE obligation_notifications SET status = 'read', read_at = :now WHERE notification_id = :id", nativeQuery = true)
    void markRead(Long id, Instant now);

    @Modifying
    @Query(value = "UPDATE obligation_notifications SET status = 'acknowledged', acknowledged_at = :now, acknowledged_by_user_id = :userId WHERE notification_id = :id", nativeQuery = true)
    void acknowledge(Long id, Integer userId, Instant now);

    @Modifying
    @Query(value = "UPDATE obligation_notifications SET status = 'read', read_at = :now WHERE status = 'unread'", nativeQuery = true)
    void markAllRead(Instant now);
}
