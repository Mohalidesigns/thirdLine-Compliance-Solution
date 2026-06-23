package com.atheris.platform.modules.webhooks.entity;

import com.atheris.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;

@Entity @Table(name = "webhook_delivery_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WebhookDeliveryLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long deliveryId;
    @Column(unique = true) private String webhookId;
    private String tenantId;
    private Long instrumentId;
    private String webhookType;
    private String status = Constants.STATUS_PENDING;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private Map<String, Object> requestPayload;
    private String requestSignature;
    private Integer responseCode;
    @Column(columnDefinition = "text") private String responseBody;
    private Integer deliveryLatencyMs;
    private Integer attemptCount = 0;
    private Integer maxAttempts = 5;
    private String lastError;
    private Instant nextRetryAt;
    private Instant deliveredAt;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
