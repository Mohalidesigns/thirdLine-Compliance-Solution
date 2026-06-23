package com.atheris.platform.modules.webhooks.repository;

import com.atheris.platform.modules.webhooks.entity.WebhookDeliveryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WebhookDeliveryLogRepository extends JpaRepository<WebhookDeliveryLog, Long> {
    Optional<WebhookDeliveryLog> findByWebhookId(String webhookId);
    List<WebhookDeliveryLog> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    @Query("SELECT w FROM WebhookDeliveryLog w WHERE w.status='failed' AND w.attemptCount < w.maxAttempts AND w.nextRetryAt < :now ORDER BY w.nextRetryAt ASC")
    List<WebhookDeliveryLog> findDueForRetry(@Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("UPDATE WebhookDeliveryLog w SET w.status='delivered', w.responseCode=:code, w.deliveryLatencyMs=:ms, w.deliveredAt=:now WHERE w.deliveryId=:id")
    void markDelivered(@Param("id") Long id, @Param("code") Integer code, @Param("ms") Integer ms, @Param("now") Instant now);

    @Modifying
    @Transactional
    @Query("UPDATE WebhookDeliveryLog w SET w.status='failed', w.lastError=:error, w.attemptCount=w.attemptCount+1, w.nextRetryAt=:retry WHERE w.deliveryId=:id")
    void markFailed(@Param("id") Long id, @Param("error") String error, @Param("retry") Instant retry);

    @Query("SELECT COUNT(w) FROM WebhookDeliveryLog w WHERE w.status='delivered' AND w.createdAt > :since")
    long countDeliveredSince(@Param("since") Instant since);

    @Query("SELECT COUNT(w) FROM WebhookDeliveryLog w WHERE w.status='failed' AND w.createdAt > :since")
    long countFailedSince(@Param("since") Instant since);
}
