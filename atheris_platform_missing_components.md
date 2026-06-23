# Atheris Platform — Missing Components Specification

> **Purpose:** Complete implementation guide for the 8 remaining components of `atheris-platform`.
> All components below are straightforward. The Flyway migrations are the most critical — the app cannot start without them.

---

## 1. Browser DTOs

**Package:** `com.atheris.platform.modules.browser.dto`

---

### `ObligationSummaryDto.java`

Compact view shown in search results and the inbox list.

```java
package com.atheris.platform.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;

@Data @Builder
public class ObligationSummaryDto {
    private Long instrumentId;
    private String sourceTitle;
    private Integer regulatorId;
    private String regulatorAbbreviation;   // e.g. "CBN"
    private String areaOfFocus;
    private String nature;                  // Core | Secondary | Guidance
    private String riskRating;              // High | Medium | Low
    private Double applicabilityConfidence;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;                  // Triage | Published | Superseded
    private String tenantClassification;    // applicable | not_applicable | under_review | unclassified
    private Boolean isWatching;             // Is this tenant watching this obligation?
    private Instant discoveredAt;
}
```

---

### `ObligationDetailDto.java`

Full detail view when a user clicks on an obligation.

```java
package com.atheris.platform.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ObligationDetailDto {
    private Long instrumentId;
    private String sourceTitle;
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private String instrumentType;
    private String areaOfFocus;
    private String nature;
    private String riskRating;
    private Double applicabilityConfidence;
    private String applicabilityNotes;
    private String aiSummary;
    private List<String> licenceTypesApplicable;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;
    private String pdfUrl;
    private String sourceUrl;
    private Instant discoveredAt;

    // Tenant-specific (null if not authenticated or no decision made)
    private String tenantClassification;    // applicable | not_applicable | under_review | unclassified
    private Boolean isWatching;

    // Specific duties extracted by AI
    private List<ObligationItem> obligations;

    // Sanctions and penalties
    private List<SanctionItem> sanctions;

    @Data @Builder
    public static class ObligationItem {
        private Integer number;
        private String statement;
        private String sectionReference;
        private String type;               // Operational | Reporting | Governance | One-time
        private String recurringDeadline;  // Continuous | Monthly | Quarterly | Annual
    }

    @Data @Builder
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal amountNaira;
        private Boolean perIncident;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
        private java.time.LocalDate recentEnforcementDate;
    }
}
```

---

### `ObligationSearchRequest.java`

Query parameters for the obligation browser search.

```java
package com.atheris.platform.modules.browser.dto;

import lombok.Data;

@Data
public class ObligationSearchRequest {
    private String q;                   // Full-text search query
    private Integer regulatorId;        // Filter by regulator
    private String riskRating;          // High | Medium | Low
    private String areaOfFocus;         // e.g. "AML/CFT"
    private String instrumentType;      // Circular | Act | Guideline etc.
    private String status;              // Published | Triage | Superseded
    private String applicableTo;        // Licence type filter
    private String since;               // ISO date — obligations published after this date
    private String tenantId;            // Set from JWT — used to show classification status
}
```

---

### `ClassifyRequest.java`

What the frontend sends when marking an obligation applicable or not.
Only two fields — everything deeper (owner, controls) is handled in the tenant app.

```java
package com.atheris.platform.modules.browser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ClassifyRequest {

    @NotBlank
    @Pattern(regexp = "applicable|not_applicable|under_review",
             message = "Must be: applicable, not_applicable, or under_review")
    private String applicability;

    private String applicabilityReasoning;
    // e.g. "GTB operates ATMs in 500+ locations. This is directly relevant."
    // Optional but recommended for audit trail.

    private String changeReason;
    // Only required when updating an existing classification.
    // e.g. "Reviewed after platform notification — risk rating increased to High."
}
```

---

### `ClassifyResponse.java`

What the API returns after a classification is saved.

```java
package com.atheris.platform.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class ClassifyResponse {
    private Long instrumentId;
    private String tenantId;
    private String applicability;          // What was decided
    private Instant classifiedAt;
    private Boolean watchCreated;          // true = tenant will now receive change notifications
    private String message;
    // e.g. "Obligation classified. You will be notified of any updates."
    private String nextStep;
    // e.g. "Open in compliance workspace to assign owner and link controls."
    // null if applicability = not_applicable
}
```

---

## 2. ObligationBrowserController

**Package:** `com.atheris.platform.modules.browser.controller`
**File:** `ObligationBrowserController.java`

Routes calls to `ObligationBrowserService` (already written).
Extract `tenantId` from the JWT claims on each request.

```java
package com.atheris.platform.modules.browser.controller;

import com.atheris.platform.modules.browser.dto.*;
import com.atheris.platform.modules.browser.service.ObligationBrowserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/intelligence")
@RequiredArgsConstructor
public class ObligationBrowserController {

    private final ObligationBrowserService service;

    // ── Obligation Library ──────────────────────────────────────────

    @GetMapping("/obligations")
    public ResponseEntity<Page<ObligationSummaryDto>> search(
            ObligationSearchRequest req,
            @AuthenticationPrincipal String tenantId,
            Pageable pageable) {
        req.setTenantId(tenantId);
        return ResponseEntity.ok(service.search(req, pageable));
    }

    @GetMapping("/obligations/{id}")
    public ResponseEntity<ObligationDetailDto> getOne(
            @PathVariable Long id,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.findById(id, tenantId));
    }

    @GetMapping("/obligations/{id}/pdf")
    public ResponseEntity<String> getPdfUrl(@PathVariable Long id) {
        // Returns a signed S3 URL (1-hour expiry) to the original PDF
        // Implement by calling StorageService.generatePresignedUrl(instrument.getPdfUrl(), 3600)
        // Return as: { "url": "https://s3.amazonaws.com/..." }
        return ResponseEntity.ok(service.getPdfPresignedUrl(id));
    }

    // ── Obligation Inbox (received, pending classification) ─────────

    @GetMapping("/inbox")
    public ResponseEntity<Page<ObligationSummaryDto>> getInbox(
            @AuthenticationPrincipal String tenantId,
            @RequestParam(required = false) String status,
            // status: unclassified | applicable | not_applicable | under_review
            Pageable pageable) {
        return ResponseEntity.ok(service.getInbox(tenantId, status, pageable));
    }

    // ── Classification (Mark applicable / not applicable) ───────────

    @PostMapping("/obligations/{id}/classify")
    public ResponseEntity<ClassifyResponse> classify(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyRequest req,
            @AuthenticationPrincipal String tenantId) {
        // Extract userId from JWT — add to the filter or use a custom principal
        return ResponseEntity.ok(service.classify(id, tenantId, req, null));
    }

    @PutMapping("/obligations/{id}/classify")
    public ResponseEntity<ClassifyResponse> updateClassification(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyRequest req,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.classify(id, tenantId, req, null));
    }

    @GetMapping("/obligations/{id}/classification")
    public ResponseEntity<?> getClassification(
            @PathVariable Long id,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.getClassification(id, tenantId));
    }

    // ── Watch Management ────────────────────────────────────────────

    @GetMapping("/watches")
    public ResponseEntity<?> getWatched(@AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.getWatched(tenantId));
    }

    @DeleteMapping("/watches/{instrumentId}")
    public ResponseEntity<Void> removeWatch(
            @PathVariable Long instrumentId,
            @AuthenticationPrincipal String tenantId) {
        service.removeClassification(instrumentId, tenantId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/watches/{instrumentId}/preferences")
    public ResponseEntity<?> updateWatchPreferences(
            @PathVariable Long instrumentId,
            @RequestBody WatchPreferencesRequest req,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.updateWatchPreferences(instrumentId, tenantId, req));
    }

    // ── Export ──────────────────────────────────────────────────────

    @GetMapping("/obligations/export")
    public ResponseEntity<?> export(
            ObligationSearchRequest req,
            @RequestParam(defaultValue = "csv") String format,
            @AuthenticationPrincipal String tenantId) {
        req.setTenantId(tenantId);
        // format: csv | xlsx
        // Returns file download
        return ResponseEntity.ok(service.export(req, format));
    }
}
```

**Also add this small DTO used by `updateWatchPreferences`:**

```java
// WatchPreferencesRequest.java
@Data
public class WatchPreferencesRequest {
    private Boolean notifyEmail;
    private Boolean notifyInApp;
    private Boolean notifyWebhook;
}
```

**Also add `getPdfPresignedUrl`, `getClassification`, `updateWatchPreferences`, `export` to `ObligationBrowserService`:**

```java
// Add these methods to ObligationBrowserService.java

public String getPdfPresignedUrl(Long instrumentId) {
    Instrument inst = instruments.findById(instrumentId)
        .orElseThrow(() -> new RuntimeException("Not found"));
    return storage.generatePresignedUrl(inst.getPdfUrl(), 3600); // 1 hour
}

public Object getClassification(Long instrumentId, String tenantId) {
    return watches.findByInstrumentIdAndTenantId(instrumentId, tenantId)
        .map(w -> Map.of(
            "instrument_id", instrumentId,
            "tenant_id", tenantId,
            "applicability", w.getClassification(),
            "classified_at", w.getClassifiedAt(),
            "is_watching", w.getIsWatching()
        ))
        .orElse(Map.of("applicability", "unclassified"));
}

public Object updateWatchPreferences(Long instrumentId, String tenantId, WatchPreferencesRequest req) {
    ObligationWatch watch = watches.findByInstrumentIdAndTenantId(instrumentId, tenantId)
        .orElseThrow(() -> new RuntimeException("No watch found for this obligation"));
    if (req.getNotifyEmail() != null) watch.setNotifyEmail(req.getNotifyEmail());
    if (req.getNotifyInApp() != null) watch.setNotifyInApp(req.getNotifyInApp());
    if (req.getNotifyWebhook() != null) watch.setNotifyWebhook(req.getNotifyWebhook());
    return watches.save(watch);
}

public Object export(ObligationSearchRequest req, String format) {
    // Query obligations matching the filter
    // For CSV: use Apache Commons CSV or OpenCSV
    // For XLSX: use Apache POI
    // Return as byte[] with appropriate Content-Type header
    // Stub for now — implement when UI is ready
    throw new UnsupportedOperationException("Export not yet implemented");
}
```

**Also add `generatePresignedUrl` to `StorageService`:**

```java
// Add to StorageService.java
public String generatePresignedUrl(String key, int expirySeconds) {
    software.amazon.awssdk.services.s3.presigner.S3Presigner presigner =
        software.amazon.awssdk.services.s3.presigner.S3Presigner.create();

    software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest presigned =
        presigner.presignGetObject(b -> b
            .signatureDuration(Duration.ofSeconds(expirySeconds))
            .getObjectRequest(r -> r.bucket(bucket).key(key)));

    return presigned.url().toString();
}
```

---

## 3. TenantService

**Package:** `com.atheris.platform.modules.tenants.service`
**File:** `TenantService.java`

```java
package com.atheris.platform.modules.tenants.service;

import com.atheris.platform.modules.tenants.dto.*;
import com.atheris.platform.modules.tenants.entity.Tenant;
import com.atheris.platform.modules.tenants.repository.TenantRepository;
import com.atheris.platform.modules.webhooks.service.WebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class TenantService {

    private final TenantRepository repo;
    private final WebhookService webhooks;

    public List<TenantDto> findAll() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    public TenantDto findById(String id) {
        return toDto(repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id)));
    }

    @Transactional
    public CreateTenantResponse create(CreateTenantRequest req, Integer createdBy) {
        String tenantId = UUID.randomUUID().toString();
        String webhookSecret = generateSecret("whsec_");
        String apiKey = generateSecret("atk_");

        Tenant t = Tenant.builder()
            .tenantId(tenantId)
            .legalName(req.getLegalName())
            .shortName(req.getShortName())
            .licenceType(req.getLicenceType())
            .licenceNumber(req.getLicenceNumber())
            .regulators(req.getRegulators())
            .productLines(req.getProductLines())
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes())
            .notificationFrequency(req.getNotificationFrequency() != null
                ? req.getNotificationFrequency() : "immediate")
            .ccoName(req.getCcoName())
            .ccoEmail(req.getCcoEmail())
            .techEmail(req.getTechEmail())
            .webhookUrl(req.getWebhookUrl())
            .webhookSecret(webhookSecret)
            .webhookEnabled(true)
            .subscriptionTier(req.getSubscriptionTier() != null
                ? req.getSubscriptionTier() : "starter")
            .isActive(true)
            .onboardedBy(createdBy)
            .onboardedAt(Instant.now())
            .build();

        repo.save(t);
        log.info("Tenant {} ({}) onboarded.", req.getLegalName(), tenantId);

        return CreateTenantResponse.builder()
            .tenantId(tenantId)
            .webhookSecret(webhookSecret)  // Shown ONCE only
            .apiKey(apiKey)
            .message("Tenant created. Test your webhook before going live.")
            .build();
    }

    @Transactional
    public TenantDto update(String id, UpdateTenantRequest req) {
        Tenant t = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id));
        if (req.getLegalName() != null) t.setLegalName(req.getLegalName());
        if (req.getWebhookUrl() != null) t.setWebhookUrl(req.getWebhookUrl());
        if (req.getCcoEmail() != null) t.setCcoEmail(req.getCcoEmail());
        if (req.getTechEmail() != null) t.setTechEmail(req.getTechEmail());
        if (req.getRegulators() != null) t.setRegulators(req.getRegulators());
        if (req.getProductLines() != null) t.setProductLines(req.getProductLines());
        if (req.getSubscribedDocumentTypes() != null)
            t.setSubscribedDocumentTypes(req.getSubscribedDocumentTypes());
        if (req.getNotificationFrequency() != null)
            t.setNotificationFrequency(req.getNotificationFrequency());
        return toDto(repo.save(t));
    }

    @Transactional
    public String rotateWebhookSecret(String id) {
        Tenant t = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id));
        String newSecret = generateSecret("whsec_");
        t.setWebhookSecret(newSecret);
        repo.save(t);
        return newSecret;  // Shown ONCE only
    }

    @Transactional
    public void deactivate(String id) {
        repo.findById(id).ifPresent(t -> {
            t.setIsActive(false);
            repo.save(t);
            log.info("Tenant {} deactivated.", id);
        });
    }

    public WebhookTestResult testWebhook(String tenantId) {
        Tenant t = repo.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found"));
        if (t.getWebhookUrl() == null)
            return WebhookTestResult.builder().delivered(false)
                .error("No webhook URL configured").build();

        long start = System.currentTimeMillis();
        try {
            webhooks.deliver(tenantId, 0L,
                Map.of("webhook_type", "ping", "message", "Atheris webhook test"),
                "ping");
            return WebhookTestResult.builder()
                .delivered(true)
                .latencyMs((int)(System.currentTimeMillis() - start))
                .build();
        } catch (Exception e) {
            return WebhookTestResult.builder()
                .delivered(false).error(e.getMessage()).build();
        }
    }

    private String generateSecret(String prefix) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return prefix + HexFormat.of().formatHex(bytes);
    }

    private TenantDto toDto(Tenant t) {
        return TenantDto.builder()
            .tenantId(t.getTenantId())
            .legalName(t.getLegalName())
            .shortName(t.getShortName())
            .licenceType(t.getLicenceType())
            .licenceNumber(t.getLicenceNumber())
            .regulators(t.getRegulators())
            .productLines(t.getProductLines())
            .subscribedDocumentTypes(t.getSubscribedDocumentTypes())
            .notificationFrequency(t.getNotificationFrequency())
            .ccoEmail(t.getCcoEmail())
            .webhookUrl(t.getWebhookUrl())
            .webhookEnabled(t.getWebhookEnabled())
            .subscriptionTier(t.getSubscriptionTier())
            .isActive(t.getIsActive())
            .onboardedAt(t.getOnboardedAt())
            .build();
    }
}
```

**DTOs needed for TenantService** (create in `modules/tenants/dto/`):

```java
// CreateTenantRequest.java
@Data
public class CreateTenantRequest {
    @NotBlank private String legalName;
    private String shortName;
    @NotBlank private String licenceType;
    private String licenceNumber;
    private List<String> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
    private String webhookUrl;
    private String subscriptionTier;
}

// CreateTenantResponse.java
@Data @Builder
public class CreateTenantResponse {
    private String tenantId;
    private String webhookSecret;    // Shown ONCE — tenant must save this
    private String apiKey;
    private String message;
}

// UpdateTenantRequest.java
@Data
public class UpdateTenantRequest {
    private String legalName;
    private String webhookUrl;
    private String ccoEmail;
    private String techEmail;
    private List<String> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
}

// TenantDto.java
@Data @Builder
public class TenantDto {
    private String tenantId;
    private String legalName;
    private String shortName;
    private String licenceType;
    private String licenceNumber;
    private List<String> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
    private String ccoEmail;
    private String webhookUrl;
    private Boolean webhookEnabled;
    private String subscriptionTier;
    private Boolean isActive;
    private Instant onboardedAt;
}

// WebhookTestResult.java
@Data @Builder
public class WebhookTestResult {
    private Boolean delivered;
    private Integer statusCode;
    private Integer latencyMs;
    private String error;
}
```

---

## 4. TenantController

**Package:** `com.atheris.platform.modules.tenants.controller`
**File:** `TenantController.java`

```java
package com.atheris.platform.modules.tenants.controller;

import com.atheris.platform.modules.tenants.dto.*;
import com.atheris.platform.modules.tenants.service.TenantService;
import com.atheris.platform.modules.webhooks.repository.WebhookDeliveryLogRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/tenants")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService service;
    private final WebhookDeliveryLogRepository deliveryLog;

    @GetMapping
    public ResponseEntity<List<TenantDto>> listAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantDto> getOne(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<CreateTenantResponse> create(
            @Valid @RequestBody CreateTenantRequest req) {
        // Pass admin userId from SecurityContext — extract from JWT principal
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, null));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TenantDto> update(
            @PathVariable String id,
            @RequestBody UpdateTenantRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PostMapping("/{id}/rotate-webhook-secret")
    public ResponseEntity<?> rotateSecret(@PathVariable String id) {
        String newSecret = service.rotateWebhookSecret(id);
        return ResponseEntity.ok(java.util.Map.of(
            "webhook_secret", newSecret,
            "message", "Secret rotated. Update your webhook handler immediately."
        ));
    }

    @PostMapping("/{id}/test-webhook")
    public ResponseEntity<WebhookTestResult> testWebhook(@PathVariable String id) {
        return ResponseEntity.ok(service.testWebhook(id));
    }

    @GetMapping("/{id}/webhook-history")
    public ResponseEntity<?> webhookHistory(
            @PathVariable String id,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(
            deliveryLog.findByTenantIdOrderByCreatedAtDesc(id).stream()
                .limit(limit).toList()
        );
    }

    @PostMapping("/{id}/webhook-history/{deliveryId}/resend")
    public ResponseEntity<?> resendWebhook(
            @PathVariable String id,
            @PathVariable Long deliveryId) {
        // Fetch the delivery log, re-attempt delivery
        // Delegate to WebhookService.retrySpecific(deliveryId)
        return ResponseEntity.ok(java.util.Map.of("message", "Resend queued"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable String id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

## 5. WebhookController

**Package:** `com.atheris.platform.modules.webhooks.controller`
**File:** `WebhookController.java`

Admin-facing endpoints for webhook management and debugging.

```java
package com.atheris.platform.modules.webhooks.controller;

import com.atheris.platform.modules.webhooks.entity.WebhookDeliveryLog;
import com.atheris.platform.modules.webhooks.repository.WebhookDeliveryLogRepository;
import com.atheris.platform.modules.webhooks.service.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/platform/webhooks")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookService webhookService;
    private final WebhookDeliveryLogRepository deliveryLog;

    // Overall delivery health stats
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        // Count delivered vs failed in last 24h
        // Implement with custom query in WebhookDeliveryLogRepository
        return ResponseEntity.ok(Map.of(
            "last_24h", Map.of(
                "delivered", 0,   // replace with repo.countDeliveredSince(Instant.now().minusSeconds(86400))
                "failed", 0       // replace with repo.countFailedSince(...)
            )
        ));
    }

    // List failed deliveries across all tenants
    @GetMapping("/failed")
    public ResponseEntity<List<WebhookDeliveryLog>> listFailed() {
        return ResponseEntity.ok(deliveryLog.findDueForRetry(Instant.now()));
    }

    // Manually trigger retry of a specific delivery
    @PostMapping("/retry/{deliveryId}")
    public ResponseEntity<?> retryDelivery(@PathVariable Long deliveryId) {
        webhookService.retryFailed(1);
        return ResponseEntity.ok(Map.of("message", "Retry queued for delivery " + deliveryId));
    }
}
```

---

## 6. AuditService

**Package:** `com.atheris.platform.shared.audit`
**File:** `AuditService.java`

Writes platform-level actions to an audit log table.
Note: this is the **platform** audit log (admin actions, scraper events).
The **tenant** compliance audit trail (hash-chained evidence) is a separate table on the tenant side.

```java
package com.atheris.platform.shared.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.Map;

@Service @Slf4j @RequiredArgsConstructor
public class AuditService {

    private final PlatformAuditLogRepository auditRepo;
    private final ObjectMapper mapper;

    /**
     * Log any significant platform action.
     *
     * @param actorId  User ID who performed the action (null = system)
     * @param action   What happened e.g. "regulator_created", "instrument_uploaded"
     * @param subject  What was acted on e.g. "regulator", "instrument", "tenant"
     * @param subjectId  ID of the subject
     * @param metadata  Any additional key-value context
     */
    public void log(Integer actorId, String action, String subject,
                    Long subjectId, Map<String, Object> metadata) {
        try {
            auditRepo.save(PlatformAuditLog.builder()
                .actorId(actorId)
                .actorType(actorId == null ? "system" : "user")
                .action(action)
                .subjectType(subject)
                .subjectId(subjectId)
                .metadataJson(mapper.writeValueAsString(metadata))
                .occurredAt(Instant.now())
                .build());
        } catch (Exception e) {
            // Audit logging must never crash the main operation
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }
}
```

**Entity needed:**

```java
// PlatformAuditLog.java
package com.atheris.platform.shared.audit;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "platform_audit_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformAuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long logId;
    private Integer actorId;
    private String actorType;           // user | system
    private String action;              // regulator_created | instrument_uploaded | tenant_onboarded etc.
    private String subjectType;         // regulator | instrument | tenant | webhook
    private Long subjectId;
    @Column(columnDefinition = "jsonb") private String metadataJson;
    private Instant occurredAt;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
```

**Repository:**

```java
// PlatformAuditLogRepository.java
package com.atheris.platform.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, Long> {
    List<PlatformAuditLog> findBySubjectTypeAndSubjectIdOrderByOccurredAtDesc(
        String subjectType, Long subjectId);
}
```

---

## 7. EmailService

**Package:** `com.atheris.platform.shared.email`
**File:** `EmailService.java`

Sends three types of email from the platform.

```java
package com.atheris.platform.shared.email;

import com.atheris.platform.modules.notifications.entity.ObligationChange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service @Slf4j @RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${atheris.email.from:noreply@atheris.com}")
    private String fromAddress;

    @Value("${atheris.email.base-url:https://app.atheris.com}")
    private String baseUrl;

    /**
     * Alert platform admin when a scraper behaves abnormally.
     * Trigger: 3 consecutive zero-document runs, or >90% volume drop.
     */
    public void sendScraperAlert(String toEmail, String regulatorName,
                                  String publicationUrl, String reason) {
        String subject = "Scraper Alert: " + regulatorName + " — action required";
        String body = """
            Hi,

            The Atheris horizon scanner has detected an issue with the %s scraper.

            Issue: %s
            Publication URL: %s

            Please check the website and update the PDF selector in the Admin UI if needed.

            %s/admin/regulators

            — Atheris Platform
            """.formatted(regulatorName, reason, publicationUrl, baseUrl);

        send(toEmail, subject, body);
    }

    /**
     * Notify a tenant user that an obligation they classified has changed.
     * Trigger: ClassificationService detects a diff after re-classification.
     */
    public void sendChangeNotification(String toEmail, String toName,
                                        String instrumentTitle, ObligationChange change,
                                        String currentClassification, String reviewLink) {
        String subject = "Update: " + instrumentTitle + " — action may be required";
        String body = """
            Hi %s,

            A regulatory obligation you have classified has been updated on the Atheris platform.

            Obligation: %s
            Your classification: %s
            Change severity: %s

            What changed:
            %s

            Please review your classification and confirm it is still correct.

            Review update: %s

            — The Atheris Platform
            """.formatted(toName, instrumentTitle, currentClassification,
                change.getChangeSeverity(), change.getChangeSummary(), reviewLink);

        send(toEmail, subject, body);
    }

    /**
     * Notify a tenant when an obligation they classified has been superseded.
     * Trigger: obligation.superseded webhook event.
     */
    public void sendSupersededNotification(String toEmail, String toName,
                                            String oldTitle, String newTitle,
                                            String reviewLink) {
        String subject = "Regulatory update: " + oldTitle + " has been superseded";
        String body = """
            Hi %s,

            An obligation you have classified has been withdrawn and replaced.

            Old: %s
            New: %s

            You may wish to:
              1. Review your classification against the new obligation
              2. Update any controls linked to the old obligation

            Review new obligation: %s

            — The Atheris Platform
            """.formatted(toName, oldTitle, newTitle, reviewLink);

        send(toEmail, subject, body);
    }

    private void send(String to, String subject, String body) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            // Email must never crash the main operation
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
```

---

## 8. Flyway Migration Scripts

**Location:** `atheris-platform/src/main/resources/db/migration/`

Files must be named `V{number}__{description}.sql`. Flyway runs them in version order on startup.

---

### `V1__create_regulators.sql`

```sql
CREATE TABLE regulators (
    regulator_id          SERIAL PRIMARY KEY,
    name                  VARCHAR(255) NOT NULL,
    abbreviation          VARCHAR(20)  NOT NULL UNIQUE,
    country               VARCHAR(100) DEFAULT 'Nigeria',
    website_url           TEXT,
    scraper_enabled       BOOLEAN      DEFAULT true,
    publication_page_url  TEXT,
    scraper_frequency     VARCHAR(50)  DEFAULT 'daily',
    scraper_strategy      VARCHAR(50)  DEFAULT 'html',
    pdf_link_selector     TEXT,
    pagination_enabled    BOOLEAN      DEFAULT false,
    pagination_selector   TEXT,
    pagination_strategy   VARCHAR(50),
    max_pages_per_run     INT          DEFAULT 3,
    max_pdf_size_mb       INT          DEFAULT 100,
    historical_start_year INT          DEFAULT 2022,
    request_headers       JSONB,
    scraper_last_ran_at   TIMESTAMP,
    scraper_last_found    INT          DEFAULT 0,
    logo_url              TEXT,
    description           TEXT,
    scraper_notes         TEXT,
    is_active             BOOLEAN      DEFAULT true,
    created_by            INT,
    created_at            TIMESTAMP    DEFAULT NOW(),
    updated_at            TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE scraper_run_logs (
    log_id             BIGSERIAL PRIMARY KEY,
    regulator_id       INT       NOT NULL REFERENCES regulators(regulator_id),
    mode               VARCHAR(50) DEFAULT 'monitoring',
    run_at             TIMESTAMP NOT NULL,
    documents_found    INT       DEFAULT 0,
    new_documents      INT       DEFAULT 0,
    skipped_documents  INT       DEFAULT 0,
    failed_documents   INT       DEFAULT 0,
    status             VARCHAR(50),
    error_message      TEXT,
    duration_ms        INT,
    created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scraper_logs_regulator ON scraper_run_logs(regulator_id, run_at DESC);
```

---

### `V2__create_instruments.sql`

```sql
CREATE TABLE instruments (
    instrument_id             BIGSERIAL PRIMARY KEY,
    regulator_id              INT          NOT NULL REFERENCES regulators(regulator_id),
    type_id                   INT,
    source_title              VARCHAR(500) NOT NULL,
    source_reference_number   VARCHAR(100),
    date_issued               DATE,
    date_commencement         DATE,
    date_superseded           DATE,
    area_of_focus             VARCHAR(255),
    theme_id                  INT,
    nature                    VARCHAR(50),
    risk_rating               VARCHAR(20),
    licence_types_applicable  JSONB,
    product_lines_applicable  JSONB,
    applicability_confidence  FLOAT,
    applicability_notes       TEXT,
    pdf_url                   TEXT,
    pdf_ocr_text              TEXT,
    pdf_hash                  VARCHAR(64),
    source_url                TEXT UNIQUE,
    source_page_url           TEXT,
    source_page_snapshot_url  TEXT,
    source_page_hash          TEXT,
    published_at              DATE,
    discovered_at             TIMESTAMP    DEFAULT NOW(),
    first_published_at        TIMESTAMP,
    status                    VARCHAR(50)  DEFAULT 'Triage',
    upload_source             VARCHAR(50)  DEFAULT 'scraper',
    uploaded_by               INT,
    is_historical_backfill    BOOLEAN      DEFAULT false,
    ai_summary                TEXT,
    created_at                TIMESTAMP    DEFAULT NOW(),
    updated_at                TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_instruments_regulator    ON instruments(regulator_id);
CREATE INDEX idx_instruments_status       ON instruments(status);
CREATE INDEX idx_instruments_risk         ON instruments(risk_rating);
CREATE INDEX idx_instruments_area         ON instruments(area_of_focus);
CREATE INDEX idx_instruments_pdf_hash     ON instruments(pdf_hash);
CREATE INDEX idx_instruments_discovered   ON instruments(discovered_at DESC);

-- Full-text search index
ALTER TABLE instruments ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(source_title, '') || ' ' ||
            coalesce(area_of_focus, '') || ' ' ||
            coalesce(ai_summary, '')
        )
    ) STORED;

CREATE INDEX idx_instruments_search ON instruments USING GIN(search_vector);
```

---

### `V3__create_obligations_and_sanctions.sql`

```sql
CREATE TABLE obligation_mappings (
    obligation_id              BIGSERIAL PRIMARY KEY,
    instrument_id              BIGINT    NOT NULL REFERENCES instruments(instrument_id),
    obligation_number          INT,
    plain_english_statement    TEXT      NOT NULL,
    specific_section_reference VARCHAR(100),
    obligation_type            VARCHAR(100),
    recurring_deadline_type    VARCHAR(50),
    compliance_deadline_days   INT,
    created_at                 TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_obligations_instrument ON obligation_mappings(instrument_id);

CREATE TABLE sanctions_and_penalties (
    sanction_id               BIGSERIAL PRIMARY KEY,
    instrument_id             BIGINT         NOT NULL REFERENCES instruments(instrument_id),
    sanction_type             VARCHAR(100),
    sanction_amount_naira     DECIMAL(15,2),
    sanction_amount_per_day   BOOLEAN,
    liable_roles              JSONB,
    personal_liability_naira  DECIMAL(15,2),
    severity_score            INT,
    has_been_enforced         BOOLEAN        DEFAULT false,
    recent_enforcement_date   DATE,
    recent_enforcement_amount DECIMAL(15,2),
    description               TEXT,
    source_section_reference  TEXT,
    created_at                TIMESTAMP      DEFAULT NOW(),
    updated_at                TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX idx_sanctions_instrument ON sanctions_and_penalties(instrument_id);
```

---

### `V4__create_tenants.sql`

```sql
CREATE TABLE tenants (
    tenant_id              VARCHAR(36)  PRIMARY KEY,
    legal_name             VARCHAR(500) NOT NULL,
    short_name             VARCHAR(100),
    licence_type           VARCHAR(100) NOT NULL,
    licence_number         VARCHAR(100),
    regulators             JSONB,
    product_lines          JSONB,
    subscribed_document_types JSONB,
    notification_frequency VARCHAR(50)  DEFAULT 'immediate',
    employee_count         INT,
    state_of_hq            VARCHAR(100),
    cco_name               VARCHAR(255),
    cco_email              VARCHAR(255),
    tech_email             VARCHAR(255),
    webhook_url            TEXT,
    webhook_secret         VARCHAR(255),
    webhook_enabled        BOOLEAN      DEFAULT true,
    subscription_tier      VARCHAR(50)  DEFAULT 'starter',
    is_active              BOOLEAN      DEFAULT true,
    onboarded_by           INT,
    onboarded_at           TIMESTAMP,
    created_at             TIMESTAMP    DEFAULT NOW(),
    updated_at             TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_tenants_licence_type ON tenants(licence_type);
CREATE INDEX idx_tenants_active       ON tenants(is_active);
```

---

### `V5__create_job_queue.sql`

```sql
CREATE TABLE job_queue (
    job_id             BIGSERIAL    PRIMARY KEY,
    job_type           VARCHAR(100) NOT NULL,
    subject_type       VARCHAR(50),
    subject_id         BIGINT,
    payload            JSONB        NOT NULL,
    status             VARCHAR(50)  DEFAULT 'pending',
    priority           INT          DEFAULT 0,
    attempt_count      INT          DEFAULT 0,
    max_attempts       INT          DEFAULT 3,
    last_error         TEXT,
    next_retry_at      TIMESTAMP,
    started_at         TIMESTAMP,
    completed_at       TIMESTAMP,
    created_by_service VARCHAR(100),
    created_at         TIMESTAMP    DEFAULT NOW(),
    updated_at         TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_job_queue_status_priority
    ON job_queue(status, priority DESC, created_at)
    WHERE status = 'pending';

CREATE INDEX idx_job_queue_retry
    ON job_queue(status, next_retry_at)
    WHERE status = 'failed';
```

---

### `V6__create_webhooks.sql`

```sql
CREATE TABLE webhook_delivery_log (
    delivery_id        BIGSERIAL    PRIMARY KEY,
    webhook_id         VARCHAR(100) UNIQUE,
    tenant_id          VARCHAR(36),
    instrument_id      BIGINT,
    webhook_type       VARCHAR(100),
    status             VARCHAR(50)  DEFAULT 'pending',
    request_payload    JSONB,
    request_signature  VARCHAR(128),
    response_code      INT,
    response_body      TEXT,
    delivery_latency_ms INT,
    attempt_count      INT          DEFAULT 0,
    max_attempts       INT          DEFAULT 5,
    last_error         TEXT,
    next_retry_at      TIMESTAMP,
    delivered_at       TIMESTAMP,
    created_at         TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_webhook_tenant     ON webhook_delivery_log(tenant_id, created_at DESC);
CREATE INDEX idx_webhook_status     ON webhook_delivery_log(status);
CREATE INDEX idx_webhook_retry      ON webhook_delivery_log(status, next_retry_at)
    WHERE status = 'failed';
```

---

### `V7__create_notifications.sql`

```sql
CREATE TABLE obligation_changes (
    change_id                       BIGSERIAL    PRIMARY KEY,
    instrument_id                   BIGINT       NOT NULL REFERENCES instruments(instrument_id),
    change_type                     VARCHAR(50)  NOT NULL,
    changed_fields                  JSONB        NOT NULL,
    change_summary                  TEXT         NOT NULL,
    change_severity                 VARCHAR(20)  DEFAULT 'medium',
    changed_by                      VARCHAR(50),
    superseded_by_instrument_id     BIGINT       REFERENCES instruments(instrument_id),
    created_at                      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_changes_instrument ON obligation_changes(instrument_id, created_at DESC);

CREATE TABLE obligation_watches (
    watch_id               BIGSERIAL   PRIMARY KEY,
    instrument_id          BIGINT      NOT NULL REFERENCES instruments(instrument_id),
    tenant_id              VARCHAR(36) NOT NULL,
    classification         VARCHAR(50),
    classified_at          TIMESTAMP,
    classified_by_user_id  INT,
    is_watching            BOOLEAN     DEFAULT true,
    notify_email           BOOLEAN     DEFAULT true,
    notify_in_app          BOOLEAN     DEFAULT true,
    notify_webhook         BOOLEAN     DEFAULT true,
    created_at             TIMESTAMP   DEFAULT NOW(),
    updated_at             TIMESTAMP   DEFAULT NOW(),
    UNIQUE (instrument_id, tenant_id)
);

CREATE INDEX idx_watches_instrument ON obligation_watches(instrument_id) WHERE is_watching = true;
CREATE INDEX idx_watches_tenant     ON obligation_watches(tenant_id)     WHERE is_watching = true;
```

---

### `V8__create_applicability.sql`

```sql
CREATE TABLE tenant_eligibility_rules (
    rule_id                    BIGSERIAL   PRIMARY KEY,
    instrument_id              BIGINT      NOT NULL REFERENCES instruments(instrument_id),
    rule_condition             TEXT,
    target_tenant_count        INT,
    should_route               BOOLEAN     DEFAULT true,
    route_with_confidence_level VARCHAR(50),
    route_with_review_flag     BOOLEAN     DEFAULT false,
    last_evaluated_at          TIMESTAMP,
    created_at                 TIMESTAMP   DEFAULT NOW(),
    updated_at                 TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX idx_eligibility_instrument ON tenant_eligibility_rules(instrument_id);
```

---

### `V9__create_platform_audit.sql`

```sql
CREATE TABLE platform_audit_log (
    log_id       BIGSERIAL    PRIMARY KEY,
    actor_id     INT,
    actor_type   VARCHAR(50)  DEFAULT 'user',
    action       VARCHAR(100) NOT NULL,
    subject_type VARCHAR(50),
    subject_id   BIGINT,
    metadata_json JSONB,
    occurred_at  TIMESTAMP    NOT NULL,
    created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_audit_action     ON platform_audit_log(action, occurred_at DESC);
CREATE INDEX idx_audit_subject    ON platform_audit_log(subject_type, subject_id);
CREATE INDEX idx_audit_actor      ON platform_audit_log(actor_id, occurred_at DESC);
```

---

## application.yml (missing from resources)

Save at: `atheris-platform/src/main/resources/application.yml`

```yaml
spring:
  application:
    name: atheris-platform
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/atheris_platform
    username: ${DB_USER:atheris}
    password: ${DB_PASSWORD:atheris}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
    show-sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 55MB
  mail:
    host: ${MAIL_HOST:smtp.gmail.com}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USER:}
    password: ${MAIL_PASSWORD:}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

server:
  port: 8080

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics

atheris:
  jwt:
    secret: ${JWT_SECRET:atheris-platform-secret-key-change-in-production}
    expiry-minutes: 15
  storage:
    bucket: ${S3_BUCKET:atheris-platform-docs}
    region: ${AWS_REGION:af-south-1}
    max-pdf-size-mb: 50
  ai:
    api-key: ${ANTHROPIC_API_KEY:}
    model: claude-sonnet-4-20250514
  email:
    from: ${EMAIL_FROM:noreply@atheris.com}
    base-url: ${BASE_URL:https://app.atheris.com}
  jobs:
    scraper-interval-ms: 900000
    ocr-processor-interval-ms: 120000
    classifier-interval-ms: 300000
    applicability-interval-ms: 300000
    webhook-sender-interval-ms: 300000
    webhook-retry-interval-ms: 1800000
```
