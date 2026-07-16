package com.atheris.compliance.intelligence.backend.modules.webhooks.repository;

import com.atheris.compliance.intelligence.backend.modules.webhooks.entity.WebhookDeliveryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WebhookDeliveryLogRepository extends JpaRepository<WebhookDeliveryLog, Long>, JpaSpecificationExecutor<WebhookDeliveryLog> {
    Optional<WebhookDeliveryLog> findByWebhookId(String webhookId);
    List<WebhookDeliveryLog> findByTenantIdOrderByCreatedAtDesc(Long tenantId);
}
