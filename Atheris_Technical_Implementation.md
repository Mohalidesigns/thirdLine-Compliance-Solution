# Atheris — Complete Technical Implementation

> **Version:** 1.1 — 19 May 2026  
> **Status:** Central platform fully designed. Tenant workflow modules next.
> **Sections:** 8 (added §8 Central Platform UI, Obligation Inbox & Change Notifications)

---

## Table of Contents

1. [System Architecture & Stack](#1--system-architecture--stack)
2. [Data Models](#2--data-models)
3. [Scraper & Horizon Scanner](#3--scraper--horizon-scanner)
4. [Classification, Applicability & Webhooks](#4--classification-applicability--webhooks)
5. [Service Design & REST APIs](#5--service-design--rest-apis)
6. [User Management & Tenant Isolation](#6--user-management--tenant-isolation)
7. [Onboarding, Subscriptions & Intelligence API](#7--onboarding-subscriptions--intelligence-api)
8. [Central Platform UI, Obligation Inbox & Change Notifications](#8--central-platform-ui-obligation-inbox--change-notifications)

---

## 1 — System Architecture & Stack


## Overview

Atheris is a Spring Boot monolith (initially) with clearly separated layers. It is not a microservices architecture at launch — that complexity is unnecessary. It is one deployable Spring Boot application with distinct service classes, one PostgreSQL database per tenant, and a central PostgreSQL database for platform intelligence.

---

## Project Structure

```
atheris-platform/
├── src/main/java/com/atheris/
│   ├── AtherisApplication.java
│   │
│   ├── config/                          # Spring configuration
│   │   ├── DatabaseConfig.java          # Central + tenant datasource routing
│   │   ├── SchedulerConfig.java         # Cron job configuration
│   │   ├── SecurityConfig.java          # JWT, roles, RBAC
│   │   └── AiConfig.java                # AI classifier setup
│   │
│   ├── platform/                        # CENTRAL PLATFORM SERVICES
│   │   ├── regulator/
│   │   │   ├── Regulator.java           # Entity
│   │   │   ├── RegulatorRepository.java
│   │   │   ├── RegulatorService.java
│   │   │   └── RegulatorController.java # Admin API
│   │   │
│   │   ├── horizon/
│   │   │   ├── HorizonScraper.java      # Cron job: scan regulator websites
│   │   │   ├── HorizonService.java
│   │   │   └── ScraperResult.java
│   │   │
│   │   ├── instrument/
│   │   │   ├── Instrument.java
│   │   │   ├── InstrumentRepository.java
│   │   │   ├── InstrumentService.java
│   │   │   └── InstrumentController.java # Admin API
│   │   │
│   │   ├── ocr/
│   │   │   ├── PdfExtractionService.java # PDFBox + Tesseract
│   │   │   └── OcrProcessorJob.java      # Cron job
│   │   │
│   │   ├── classification/
│   │   │   ├── AiClassifierService.java  # AI classification
│   │   │   ├── ClassificationResult.java
│   │   │   └── ClassifierJob.java        # Cron job
│   │   │
│   │   ├── applicability/
│   │   │   ├── ApplicabilityService.java
│   │   │   ├── TenantEligibilityRule.java
│   │   │   └── ApplicabilityJob.java     # Cron job
│   │   │
│   │   ├── webhook/
│   │   │   ├── WebhookService.java
│   │   │   ├── WebhookDeliveryLog.java
│   │   │   ├── WebhookSenderJob.java     # Cron job
│   │   │   └── WebhookRetryJob.java      # Cron job
│   │   │
│   │   ├── tenant/
│   │   │   ├── Tenant.java
│   │   │   ├── TenantRepository.java
│   │   │   ├── TenantService.java
│   │   │   └── TenantController.java    # Admin API
│   │   │
│   │   └── queue/
│   │       ├── JobQueue.java
│   │       ├── JobQueueRepository.java
│   │       └── JobQueueService.java
│   │
│   ├── tenant/                          # TENANT-SIDE SERVICES
│   │   ├── obligation/
│   │   │   ├── ReceivedObligation.java
│   │   │   ├── ObligationRepository.java
│   │   │   ├── ObligationService.java
│   │   │   └── ObligationController.java
│   │   │
│   │   ├── control/
│   │   │   ├── Control.java
│   │   │   ├── ControlRepository.java
│   │   │   ├── ControlService.java
│   │   │   └── ControlController.java
│   │   │
│   │   ├── testing/
│   │   │   ├── ControlTestResult.java
│   │   │   ├── TestResultRepository.java
│   │   │   ├── TestResultService.java
│   │   │   └── TestResultController.java
│   │   │
│   │   ├── finding/
│   │   │   ├── Finding.java
│   │   │   ├── FindingRepository.java
│   │   │   ├── FindingService.java
│   │   │   └── FindingController.java
│   │   │
│   │   ├── returns/
│   │   │   ├── RegulatoryReturn.java
│   │   │   ├── ReturnFilingInstance.java
│   │   │   ├── ReturnRepository.java
│   │   │   ├── ReturnService.java
│   │   │   └── ReturnController.java
│   │   │
│   │   ├── audit/
│   │   │   ├── AuditEvent.java
│   │   │   ├── AuditRepository.java
│   │   │   └── AuditService.java
│   │   │
│   │   ├── webhook/
│   │   │   └── TenantWebhookReceiver.java  # Receives platform webhooks
│   │   │
│   │   └── dashboard/
│   │       ├── DashboardSnapshot.java
│   │       ├── DashboardService.java
│   │       └── DashboardController.java
│   │
│   └── shared/
│       ├── security/
│       │   ├── JwtFilter.java
│       │   └── RolePermissions.java
│       ├── exception/
│       │   └── GlobalExceptionHandler.java
│       └── util/
│           ├── HashUtil.java
│           └── PaginationUtil.java
│
├── src/main/resources/
│   ├── application.yml
│   ├── application-central.yml          # Central platform config
│   └── application-tenant.yml           # Tenant config
│
└── pom.xml
```

---

## Database Routing

Two database contexts in one application:

```java
// config/DatabaseConfig.java

@Configuration
public class DatabaseConfig {

    // Central platform database (regulators, instruments, tenants)
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.central")
    public DataSource centralDataSource() {
        return DataSourceBuilder.create().build();
    }

    // Tenant database (routes based on tenant_id in JWT token)
    @Bean
    @ConfigurationProperties("spring.datasource.tenant")
    public DataSource tenantDataSource() {
        return new TenantRoutingDataSource(); // Custom routing
    }
}

// TenantRoutingDataSource.java
public class TenantRoutingDataSource extends AbstractRoutingDataSource {
    
    @Override
    protected Object determineCurrentLookupKey() {
        // Get tenant_id from JWT token in the current request
        return TenantContext.getCurrentTenantId();
    }
}
```

---

## application.yml

```yaml
spring:
  datasource:
    central:
      url: jdbc:postgresql://localhost:5432/atheris_central
      username: ${DB_CENTRAL_USER}
      password: ${DB_CENTRAL_PASS}
    tenant:
      # Tenant databases are registered dynamically when tenants onboard
      # Format: jdbc:postgresql://localhost:5432/atheris_tenant_{tenant_id}

atheris:
  ai:
    provider: anthropic          # or openai, or local
    model: claude-haiku-4-5     # cheap + fast for classification
    api-key: ${AI_API_KEY}
  
  ocr:
    min-text-length: 100        # Below this = scanned PDF, use Tesseract
    tesseract-data-path: /usr/share/tessdata
    tesseract-language: eng
  
  webhook:
    signing-algorithm: HmacSHA256
    timeout-seconds: 10
    max-retries: 5
  
  scraper:
    user-agent: "Atheris Compliance Platform / 1.0"
    connection-timeout-ms: 30000
    read-timeout-ms: 60000
```

---

## CENTRAL PLATFORM APIs

---

### 1. Regulator Management API

**Base path:** `/api/v1/admin/regulators`

**Who uses it:** Platform admin (you / your team)

```
GET    /api/v1/admin/regulators              List all regulators
POST   /api/v1/admin/regulators              Add a new regulator
GET    /api/v1/admin/regulators/{id}         Get one regulator
PUT    /api/v1/admin/regulators/{id}         Update regulator (change URL, name, etc.)
DELETE /api/v1/admin/regulators/{id}         Deactivate regulator
PATCH  /api/v1/admin/regulators/{id}/toggle  Enable/disable scraper for this regulator
GET    /api/v1/admin/regulators/{id}/test    Test-scrape this URL (dry run, don't save)
```

**Request body — POST/PUT regulator:**
```json
{
  "name": "Central Bank of Nigeria",
  "abbreviation": "CBN",
  "website_url": "https://www.cbn.gov.ng",
  "publication_page_url": "https://www.cbn.gov.ng/supervision/circulars.asp",
  "scraper_enabled": true,
  "scraper_frequency": "daily",
  "scraper_strategy": "html_link_scan",
  "scraper_css_selector": "a[href$='.pdf']",
  "contact_email": "info@cbn.gov.ng"
}
```

**Scraper strategies (configurable per regulator):**
```
html_link_scan   — Scan HTML page for PDF links (most regulators)
sitemap_xml      — Read XML sitemap
rss_feed         — Parse RSS feed (if available)
manual_only      — No auto-scrape, admin uploads manually
```

**RegulatorController.java:**
```java
@RestController
@RequestMapping("/api/v1/admin/regulators")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class RegulatorController {

    @Autowired
    private RegulatorService regulatorService;

    @GetMapping
    public ResponseEntity<Page<RegulatorDto>> listRegulators(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size,
        @RequestParam(required = false) Boolean scraperEnabled
    ) {
        return ResponseEntity.ok(regulatorService.findAll(page, size, scraperEnabled));
    }

    @PostMapping
    public ResponseEntity<RegulatorDto> createRegulator(
        @RequestBody @Valid CreateRegulatorRequest request
    ) {
        RegulatorDto created = regulatorService.create(request);
        return ResponseEntity.status(201).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegulatorDto> updateRegulator(
        @PathVariable Long id,
        @RequestBody @Valid UpdateRegulatorRequest request
    ) {
        return ResponseEntity.ok(regulatorService.update(id, request));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<RegulatorDto> toggleScraper(@PathVariable Long id) {
        return ResponseEntity.ok(regulatorService.toggleScraper(id));
    }

    @GetMapping("/{id}/test")
    public ResponseEntity<ScraperTestResult> testScraper(@PathVariable Long id) {
        // Dry-run the scraper for this regulator and return what it would find
        ScraperTestResult result = regulatorService.testScrape(id);
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/{id}/scrape-history")
    public ResponseEntity<List<ScrapeHistoryDto>> getScrapeHistory(@PathVariable Long id) {
        return ResponseEntity.ok(regulatorService.getScrapeHistory(id));
    }
}
```

**RegulatorService.java:**
```java
@Service
public class RegulatorService {

    @Autowired
    private RegulatorRepository regulatorRepo;

    @Autowired
    private HorizonScraper horizonScraper;

    public RegulatorDto create(CreateRegulatorRequest request) {
        
        // Validate URL is reachable
        if (!isUrlReachable(request.getPublicationPageUrl())) {
            throw new InvalidUrlException("Publication page URL is not reachable: " + request.getPublicationPageUrl());
        }

        Regulator regulator = Regulator.builder()
            .name(request.getName())
            .abbreviation(request.getAbbreviation())
            .websiteUrl(request.getWebsiteUrl())
            .publicationPageUrl(request.getPublicationPageUrl())
            .scraperEnabled(request.isScraperEnabled())
            .scraperFrequency(request.getScraperFrequency())
            .scraperStrategy(request.getScraperStrategy())
            .scraperCssSelector(request.getScraperCssSelector())
            .contactEmail(request.getContactEmail())
            .createdAt(Instant.now())
            .build();
        
        regulator = regulatorRepo.save(regulator);
        
        // Audit log
        auditService.log("regulator_created", "regulator", regulator.getRegulatorId(), null, regulator);
        
        return RegulatorDto.from(regulator);
    }

    public ScraperTestResult testScrape(Long regulatorId) {
        Regulator regulator = regulatorRepo.findById(regulatorId)
            .orElseThrow(() -> new NotFoundException("Regulator not found"));
        
        // Dry run — find what the scraper would detect but DON'T save
        List<ScrapedDocument> found = horizonScraper.dryRun(regulator);
        
        // Filter out documents already in instruments table
        List<ScrapedDocument> newDocuments = found.stream()
            .filter(d -> !instrumentRepo.existsByPdfHash(sha256(d.getUrl())))
            .collect(Collectors.toList());
        
        return ScraperTestResult.builder()
            .regulatorId(regulatorId)
            .urlScraped(regulator.getPublicationPageUrl())
            .documentsFound(found.size())
            .newDocuments(newDocuments.size())
            .documents(newDocuments)
            .testedAt(Instant.now())
            .build();
    }
}
```

---

### 2. Instrument Management API (Admin)

**Base path:** `/api/v1/admin/instruments`

```
GET    /api/v1/admin/instruments             List all instruments (paginated)
POST   /api/v1/admin/instruments/upload      Manually upload a PDF
GET    /api/v1/admin/instruments/{id}        Get one instrument
PUT    /api/v1/admin/instruments/{id}        Update instrument metadata
POST   /api/v1/admin/instruments/{id}/classify  Re-run AI classification
POST   /api/v1/admin/instruments/{id}/publish   Approve and publish to tenants
DELETE /api/v1/admin/instruments/{id}        Remove an instrument
GET    /api/v1/admin/instruments/{id}/obligations  List obligations for this instrument
```

**Manual Upload Endpoint (the important one):**

```java
@PostMapping("/upload")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public ResponseEntity<InstrumentDto> uploadDocument(
    @RequestParam("file") MultipartFile file,
    @RequestParam("regulator_id") Long regulatorId,
    @RequestParam("title") String title,
    @RequestParam(value = "date_issued", required = false) LocalDate dateIssued,
    @RequestParam(value = "type_id", defaultValue = "3") Integer typeId,
    @RequestParam(value = "auto_classify", defaultValue = "true") boolean autoClassify,
    @RequestParam(value = "auto_publish", defaultValue = "false") boolean autoPublish
) {
    // Validate file type
    if (!file.getContentType().equals("application/pdf")) {
        return ResponseEntity.badRequest().body(null);
    }
    
    // Validate file size (max 50MB)
    if (file.getSize() > 50 * 1024 * 1024) {
        return ResponseEntity.badRequest().body(null);
    }
    
    InstrumentDto result = instrumentService.processManualUpload(
        file.getBytes(),
        regulatorId,
        title,
        dateIssued,
        typeId,
        autoClassify,
        autoPublish
    );
    
    return ResponseEntity.status(201).body(result);
}
```

**InstrumentService.processManualUpload:**
```java
public InstrumentDto processManualUpload(
    byte[] pdfBytes,
    Long regulatorId,
    String title,
    LocalDate dateIssued,
    Integer typeId,
    boolean autoClassify,
    boolean autoPublish
) {
    // 1. Compute hash (check duplicate)
    String pdfHash = HashUtil.sha256(pdfBytes);
    if (instrumentRepo.existsByPdfHash(pdfHash)) {
        throw new DuplicateDocumentException("This PDF was already uploaded");
    }
    
    // 2. Store PDF in S3 (or local storage)
    String pdfUrl = storageService.store(pdfBytes, "instruments/" + pdfHash + ".pdf");
    
    // 3. Extract text immediately (synchronous for manual uploads)
    String extractedText = pdfExtractionService.extractText(pdfBytes);
    
    // 4. Create instrument record
    Instrument instrument = Instrument.builder()
        .regulatorId(regulatorId)
        .typeId(typeId)
        .sourceTitle(title)
        .dateIssued(dateIssued != null ? dateIssued : LocalDate.now())
        .pdfUrl(pdfUrl)
        .pdfOcrText(extractedText)
        .pdfHash(pdfHash)
        .status("Triage")
        .discoveredAt(Instant.now())
        .source("manual_upload")
        .build();
    
    instrument = instrumentRepo.save(instrument);
    
    // 5. If autoClassify: enqueue classification job (or do it synchronously)
    if (autoClassify) {
        jobQueueService.enqueue("classify_instrument", "instrument", instrument.getInstrumentId(),
            Map.of(
                "instrument_id", instrument.getInstrumentId(),
                "pdf_ocr_text", extractedText
            ),
            "admin-upload"
        );
    }
    
    // 6. Audit log
    auditService.log("instrument_uploaded_manually", "instrument", instrument.getInstrumentId(),
        null,
        Map.of("title", title, "regulator_id", regulatorId, "auto_classify", autoClassify)
    );
    
    return InstrumentDto.from(instrument);
}
```

---

### 3. Tenant Management API

**Base path:** `/api/v1/admin/tenants`

```
GET    /api/v1/admin/tenants                 List all tenants
POST   /api/v1/admin/tenants                 Onboard new tenant
GET    /api/v1/admin/tenants/{id}            Get tenant details
PUT    /api/v1/admin/tenants/{id}            Update tenant profile
PATCH  /api/v1/admin/tenants/{id}/toggle     Activate/deactivate
GET    /api/v1/admin/tenants/{id}/stats      Compliance stats for this tenant
POST   /api/v1/admin/tenants/{id}/resend-obligations  Resend missed obligations
GET    /api/v1/admin/tenants/{id}/webhooks   Webhook delivery history
POST   /api/v1/admin/tenants/{id}/rotate-secret  Rotate webhook secret
```

**POST /api/v1/admin/tenants — Onboard a tenant:**
```json
{
  "legal_name": "Guaranty Trust Bank Plc",
  "short_name": "GTB",
  "licence_type": "Commercial Bank",
  "licence_number": "RC0120",
  "cbx_registration_number": "CBN/2001/RC-001",
  "regulators": ["CBN", "NDIC", "SEC"],
  "product_lines": ["Retail Banking", "Corporate Banking", "Consumer Credit"],
  "employees_count": 12000,
  "geographic_scope": "Nigeria",
  "cco_email": "compliance@gtb.com",
  "cco_name": "John Adeyemi",
  "tech_contact_email": "api-team@gtb.com",
  "webhook_url": "https://compliance.gtb.com/v1/webhooks/atheris",
  "subscription_tier": "Enterprise"
}
```

**TenantService.create:**
```java
@Transactional
public TenantDto create(CreateTenantRequest request) {
    
    // 1. Create tenant record in central DB
    String tenantId = UUID.randomUUID().toString();
    String webhookSecret = generateSecureSecret();
    
    Tenant tenant = Tenant.builder()
        .tenantId(tenantId)
        .legalName(request.getLegalName())
        .shortName(request.getShortName())
        .licenceType(request.getLicenceType())
        .regulators(request.getRegulators())
        .productLines(request.getProductLines())
        .employeesCount(request.getEmployeesCount())
        .webhookUrl(request.getWebhookUrl())
        .webhookSecret(webhookSecret) // Store encrypted
        .isActive(true)
        .onboardedAt(Instant.now())
        .build();
    
    tenantRepo.save(tenant);
    
    // 2. Provision tenant database
    tenantDatabaseService.provision(tenantId);
    
    // 3. Send all existing applicable obligations to this new tenant
    // (Backfill — they need to know about everything that already exists)
    jobQueueService.enqueue("backfill_tenant_obligations", "tenant", null,
        Map.of("tenant_id", tenantId),
        "tenant-onboarding"
    );
    
    // 4. Send welcome email with webhook secret and documentation
    emailService.sendTenantWelcome(tenant, webhookSecret);
    
    // 5. Audit log
    auditService.log("tenant_onboarded", "tenant", tenantId, null, tenant);
    
    return TenantDto.from(tenant, webhookSecret);
}
```

---

### 4. Horizon Scraper Service

```java
// horizon/HorizonScraper.java

@Service
public class HorizonScraper {

    @Scheduled(cron = "0 0 2 * * *") // 2 AM every night
    public void runNightlyScrape() {
        log.info("Starting nightly horizon scan");
        
        List<Regulator> activeRegulators = regulatorRepo.findByScraperEnabledTrue();
        
        for (Regulator regulator : activeRegulators) {
            try {
                scrapeRegulator(regulator);
            } catch (Exception e) {
                log.error("Failed to scrape regulator {}: {}", regulator.getAbbreviation(), e.getMessage());
                // Continue to next regulator — one failure doesn't stop the batch
            }
        }
        
        log.info("Nightly horizon scan complete. Processed {} regulators", activeRegulators.size());
    }

    public void scrapeRegulator(Regulator regulator) {
        log.info("Scanning {} — {}", regulator.getAbbreviation(), regulator.getPublicationPageUrl());
        
        List<ScrapedDocument> documents = switch (regulator.getScraperStrategy()) {
            case "html_link_scan" -> scrapeHtmlLinks(regulator);
            case "sitemap_xml"    -> scrapeSitemap(regulator);
            case "rss_feed"       -> scrapeRssFeed(regulator);
            case "manual_only"    -> List.of(); // No auto-scrape
            default               -> scrapeHtmlLinks(regulator); // Default
        };
        
        int newCount = 0;
        for (ScrapedDocument doc : documents) {
            if (isNewDocument(doc, regulator)) {
                // Enqueue for OCR + classification
                jobQueueService.enqueue("ocr_document", null, null,
                    Map.of(
                        "regulator_id", regulator.getRegulatorId(),
                        "pdf_url", doc.getPdfUrl(),
                        "title", doc.getTitle(),
                        "source_page_url", doc.getSourcePageUrl()
                    ),
                    "horizon-scraper"
                );
                newCount++;
            }
        }
        
        // Update last_scraped_at on regulator
        regulatorRepo.updateLastScrapedAt(regulator.getRegulatorId(), Instant.now());
        
        log.info("{}: Found {} documents, {} new", 
            regulator.getAbbreviation(), documents.size(), newCount);
    }

    private List<ScrapedDocument> scrapeHtmlLinks(Regulator regulator) {
        Document page = Jsoup.connect(regulator.getPublicationPageUrl())
            .userAgent(scraperUserAgent)
            .timeout(connectionTimeoutMs)
            .get();
        
        String selector = regulator.getScraperCssSelector() != null
            ? regulator.getScraperCssSelector()
            : "a[href$='.pdf']"; // Default: any link ending in .pdf
        
        return page.select(selector).stream()
            .map(link -> ScrapedDocument.builder()
                .title(link.text().trim())
                .pdfUrl(resolveUrl(regulator.getWebsiteUrl(), link.attr("href")))
                .sourcePageUrl(regulator.getPublicationPageUrl())
                .build()
            )
            .filter(doc -> doc.getPdfUrl() != null && !doc.getPdfUrl().isEmpty())
            .collect(Collectors.toList());
    }
    
    private boolean isNewDocument(ScrapedDocument doc, Regulator regulator) {
        // Check if we've already processed this URL
        return !instrumentRepo.existsBySourceUrlAndRegulatorId(
            doc.getPdfUrl(), 
            regulator.getRegulatorId()
        );
    }
}
```

---

### 5. AI Classifier Service

```java
// classification/AiClassifierService.java

@Service
public class AiClassifierService {

    @Autowired
    private AnthropicClient anthropicClient; // or OpenAI

    public ClassificationResult classify(Long instrumentId, String ocrText) {
        
        String prompt = buildClassificationPrompt(ocrText);
        
        // Call AI API
        String responseJson = anthropicClient.complete(prompt, "claude-haiku-4-5-20251001");
        
        // Parse structured response
        return parseClassificationResponse(responseJson);
    }

    private String buildClassificationPrompt(String ocrText) {
        return """
            You are a Nigerian financial regulation compliance expert.
            
            Analyze the following regulatory document text and return ONLY a JSON object.
            
            Document text:
            ---
            %s
            ---
            
            Return ONLY this JSON structure (no other text):
            {
              "area_of_focus": "<one of: AML/CFT, Cash Management, Corporate Governance, Consumer Protection, Data Protection, Cybersecurity, Capital Market, ABAC, ESG, Account Management, Financial Reporting, Conduct Risk>",
              "nature": "<one of: Core, Directive, Guidance>",
              "risk_rating": "<one of: High, Medium, Low>",
              "risk_rating_reason": "<one sentence explaining the rating>",
              "licence_types_applicable": ["<array of: Commercial Bank, Merchant Bank, Microfinance Bank, Finance Company, Fintech, PFA, Insurance, Capital Market Dealer, All>"],
              "applicability_confidence": <float between 0.0 and 1.0>,
              "applicability_notes": "<brief note about who this applies to>",
              "ai_summary": "<3-5 sentence plain English summary of what this circular requires>",
              "obligations": [
                {
                  "number": 1,
                  "statement": "<plain English statement of what the bank must do>",
                  "section_reference": "<section number e.g. Section 4.1>",
                  "type": "<one of: Operational, Reporting, Governance, Continuous>",
                  "deadline_type": "<one of: One-time, Continuous, Monthly, Quarterly, Annual, As-needed>"
                }
              ],
              "key_terms": ["<important terms from the document>"],
              "date_commencement": "<ISO date if mentioned, else null>"
            }
            """.formatted(ocrText.substring(0, Math.min(ocrText.length(), 8000))); // First 8000 chars
    }
}
```

---

## TENANT-SIDE APIs

---

### 6. Tenant Webhook Receiver

```java
// tenant/webhook/TenantWebhookReceiver.java

@RestController
@RequestMapping("/api/v1/webhooks")
public class TenantWebhookReceiver {

    @PostMapping("/atheris")
    public ResponseEntity<Map<String, String>> receiveWebhook(
        @RequestBody String rawBody,
        @RequestHeader("X-Atheris-Signature") String signature,
        @RequestHeader("X-Webhook-Event-ID") String eventId,
        @RequestHeader("X-Webhook-Timestamp") String timestamp
    ) {
        // 1. Verify HMAC signature
        if (!webhookVerifier.verify(rawBody, signature)) {
            log.warn("Invalid webhook signature for event {}", eventId);
            return ResponseEntity.status(401).body(Map.of("error", "Invalid signature"));
        }
        
        // 2. Check idempotency (already processed?)
        if (idempotencyService.isAlreadyProcessed(eventId)) {
            log.info("Webhook {} already processed, skipping", eventId);
            return ResponseEntity.ok(Map.of("status", "already_processed"));
        }
        
        // 3. Parse webhook
        WebhookPayload payload = objectMapper.readValue(rawBody, WebhookPayload.class);
        
        // 4. Route to correct handler based on webhook_type
        switch (payload.getWebhookType()) {
            case "obligation.received"          -> handleObligationReceived(payload);
            case "obligation.applicability_updated" -> handleApplicabilityUpdated(payload);
            case "obligation.superseded"        -> handleObligationSuperseded(payload);
            default -> log.warn("Unknown webhook type: {}", payload.getWebhookType());
        }
        
        // 5. Mark as processed (idempotency)
        idempotencyService.markProcessed(eventId);
        
        return ResponseEntity.ok(Map.of("status", "received"));
    }

    private void handleObligationReceived(WebhookPayload payload) {
        ObligationPayload obligation = payload.getObligation();
        
        // Insert into received_obligations
        ReceivedObligation received = ReceivedObligation.builder()
            .obligationId(obligation.getObligationId())
            .platformObligationId(obligation.getPlatformObligationId())
            .sourceTitle(obligation.getSourceTitle())
            .regulator(obligation.getRegulator())
            .areaOfFocus(obligation.getAreaOfFocus())
            .platformRiskRating(obligation.getRiskRating())
            .isApplicable(null) // Not yet decided
            .status("Received")
            .platformReceivedAt(Instant.now())
            .build();
        
        obligationRepo.save(received);
        
        // Create task for compliance team
        taskService.createObligationReviewTask(received);
        
        // Audit log
        auditService.log("obligation_received", "obligation", received.getObligationId(), null, received);
    }
}
```

---

### 7. Obligation Controller (Tenant)

```
GET    /api/v1/obligations                   List all obligations (paginated, filterable)
GET    /api/v1/obligations/{id}              Get one obligation
PATCH  /api/v1/obligations/{id}/classify     Set applicability, risk rating, owner
POST   /api/v1/obligations/{id}/controls     Link a control to an obligation
GET    /api/v1/obligations/{id}/history      Full audit history for this obligation
```

**PATCH /api/v1/obligations/{id}/classify:**
```json
{
  "is_applicable": true,
  "applicability_reasoning": "GTB operates ATMs across 500+ branches. This is directly applicable.",
  "tenant_risk_rating": "High",
  "risk_rating_reasoning": "Penalty ₦1m/branch. CBN has enforced this in 2024.",
  "assigned_owner_user_id": 123,
  "linked_control_ids": [44, 45]
}
```

---

### 8. Control Controller (Tenant)

```
GET    /api/v1/controls                      List all controls
POST   /api/v1/controls                      Create a new control
GET    /api/v1/controls/{id}                 Get one control
PUT    /api/v1/controls/{id}                 Update control
GET    /api/v1/controls/{id}/tests           List test results for this control
POST   /api/v1/controls/{id}/tests           Submit a new test result
GET    /api/v1/controls/{id}/findings        List findings for this control
GET    /api/v1/controls/due                  Controls with tests due in the next 30 days
```

**POST /api/v1/controls/{id}/tests — Submit test result:**
```json
{
  "test_date": "2026-01-13",
  "result": "Failed",
  "result_description": "3 ATMs unfunded >24h: Ikeja (31h), VI (28h), Lekki (29h)",
  "failure_details": "Cash forecasting system down Jan 11-12. Root cause: server outage.",
  "failure_severity": "High",
  "evidence_document": "<base64 encoded PDF or multipart file upload>"
}
```

**TestResultService — Auto-opens finding if failed:**
```java
@Transactional
public ControlTestResult submitTestResult(Long controlId, SubmitTestRequest request, Integer userId) {
    
    Control control = controlRepo.findById(controlId)
        .orElseThrow(() -> new NotFoundException("Control not found"));
    
    // Store evidence
    String evidenceUrl = null;
    if (request.getEvidenceDocument() != null) {
        evidenceUrl = storageService.store(
            request.getEvidenceDocument(),
            "evidence/" + controlId + "/" + LocalDate.now() + ".pdf"
        );
    }
    
    // Create test result
    ControlTestResult result = ControlTestResult.builder()
        .controlId(controlId)
        .testDate(request.getTestDate())
        .testPerformedByUserId(userId)
        .result(request.getResult())
        .resultDescription(request.getResultDescription())
        .failureDetails(request.getFailureDetails())
        .failureSeverity(request.getFailureSeverity())
        .evidenceUrl(evidenceUrl)
        .reviewStatus("Pending")
        .createdAt(Instant.now())
        .build();
    
    result = testResultRepo.save(result);
    
    // Auto-open finding if test failed
    if ("Failed".equals(request.getResult())) {
        findingService.autoOpenFinding(control, result);
    }
    
    // Update control effectiveness rating
    controlService.recalculateEffectivenessRating(controlId);
    
    // Audit log (immutable, hash-chained)
    auditService.log(
        "control_test_recorded",
        "control",
        controlId,
        null,
        Map.of(
            "result", request.getResult(),
            "test_date", request.getTestDate(),
            "evidence_url", evidenceUrl
        )
    );
    
    // Notify compliance reviewer
    notificationService.notifyControlTestSubmitted(control, result);
    
    return result;
}
```

---

### 9. Finding Controller (Tenant)

```
GET    /api/v1/findings                      List all findings (filter by status, severity)
GET    /api/v1/findings/{id}                 Get finding details + full history
PATCH  /api/v1/findings/{id}/assign          Assign remediation owner + deadline
PATCH  /api/v1/findings/{id}/remediate       Mark as remediated (upload evidence)
PATCH  /api/v1/findings/{id}/close           CCO closes the finding
GET    /api/v1/findings/overdue              Findings past remediation deadline
GET    /api/v1/findings/summary              Count by severity/status
```

---

### 10. Returns Controller (Tenant)

```
GET    /api/v1/returns                       List all returns (with next due date)
GET    /api/v1/returns/calendar              Calendar view of upcoming filings
GET    /api/v1/returns/{id}                  Get return + filing history
POST   /api/v1/returns/{id}/submit           Submit a filing (upload evidence)
GET    /api/v1/returns/overdue               Overdue returns
```

**POST /api/v1/returns/{id}/submit:**
```json
{
  "submitted_date": "2026-06-10",
  "submission_evidence": "<base64 PDF — regulator acknowledgment receipt>",
  "notes": "Submitted via CBN FIRS portal. Reference: CBN-2026-0610-001"
}
```

---

### 11. Dashboard Controller (Tenant)

```
GET    /api/v1/dashboard/summary             Headline metrics (compliance score, etc.)
GET    /api/v1/dashboard/board-pack          Generate board pack (PDF)
GET    /api/v1/dashboard/obligations         Obligation breakdown by theme/risk
GET    /api/v1/dashboard/controls            Control effectiveness summary
GET    /api/v1/dashboard/findings            Findings trend chart data
GET    /api/v1/dashboard/returns             Return filing calendar data
```

---

### 12. Audit Controller (Tenant + Examiner)

```
GET    /api/v1/audit/events                  Full audit log (paginated)
GET    /api/v1/audit/events/{id}             Single audit event
GET    /api/v1/audit/evidence-pack/{type}/{id}  Generate evidence pack for an obligation/control
GET    /api/v1/audit/verify-chain            Verify audit chain integrity (for examiners)
```

---

## Complete Flow: Manual Upload by Admin

```
1. Admin opens Atheris admin UI
2. Admin navigates to Instruments > Upload Document
3. Admin fills in:
   - Regulator: CBN (dropdown from /api/v1/admin/regulators)
   - Title: "Re: Guidelines on ATM Cash Disbursement"
   - Date Issued: 2026-05-28
   - File: [uploads PDF]
   - Auto-classify: Yes
   - Auto-publish: No (admin will review before pushing to tenants)
4. POST /api/v1/admin/instruments/upload
5. Service:
   a. Validates PDF (type, size)
   b. Computes hash (checks duplicate)
   c. Stores PDF in S3
   d. Runs PDFBox extraction (synchronous, < 1 second for digital PDF)
   e. Falls back to Tesseract if needed (5-30 seconds)
   f. Creates instrument record (status: Triage)
   g. Enqueues 'classify_instrument' job
6. Admin sees: "Document uploaded. AI classification in progress."
7. 5 minutes later, classifier cron runs:
   a. Calls AI with OCR text
   b. Returns: area_of_focus, risk_rating, obligations, etc.
   c. Updates instrument: status = 'Classified'
8. Admin gets notified: "Classification complete. Review required."
9. Admin reviews classification on UI
10. Admin clicks "Approve and Publish"
11. POST /api/v1/admin/instruments/{id}/publish
12. Applicability evaluated → Webhooks sent to Commercial Banks
13. GTB, Access, Zenith receive webhook → Obligation lands in compliance team inbox
```

---

## Complete Flow: Automated Nightly Scan

```
2:00 AM  Cron: HorizonScraper.runNightlyScrape()
         → Loops over all enabled regulators
         → For each: scrape HTML page for new PDFs
         → For each new PDF: enqueue 'ocr_document' job

2:02 AM  Cron: OcrProcessorJob (every 2 min)
         → Gets pending 'ocr_document' job
         → Downloads PDF
         → Runs PDFBox (or Tesseract)
         → Creates instrument record
         → Enqueues 'classify_instrument' job

2:07 AM  Cron: ClassifierJob (every 5 min)
         → Gets pending 'classify_instrument' job
         → Calls AI classifier
         → Updates instrument with metadata
         → Enqueues 'evaluate_applicability' job

2:12 AM  Cron: ApplicabilityJob (every 5 min)
         → Gets pending 'evaluate_applicability' job
         → Builds routing rule
         → Queries matching tenants
         → Enqueues 'send_webhooks' job

2:17 AM  Cron: WebhookSenderJob (every 5 min)
         → Gets pending 'send_webhooks' job
         → Builds signed payloads
         → POSTs to each tenant endpoint
         → Records in webhook_delivery_log

2:17 AM  GTB webhook receiver
         → Verifies signature
         → Inserts into received_obligations
         → Creates task for Ngozi
         → Logs audit event

8:00 AM  Ngozi opens dashboard
         → New obligation waiting for review
```

---

## Security Model

```
Roles:
  PLATFORM_ADMIN   — Full access to admin endpoints
  TENANT_ADMIN     — Can manage tenant settings, users
  CCO              — Full read + approve findings, sign off returns, view all data
  COMPLIANCE_MANAGER — Classify obligations, raise findings, review tests
  COMPLIANCE_ANALYST — Test controls, submit returns, view everything
  AUDITOR          — Read-only access to all data including audit log
  EXAMINER         — Read-only portal (regulator access, time-limited)

JWT token payload:
  {
    "sub": "user_id",
    "tenant_id": "uuid-gtb",
    "role": "COMPLIANCE_ANALYST",
    "email": "ngozi.eze@gtb.com",
    "exp": 1234567890
  }
```

---

## Error Handling

All APIs return consistent error responses:

```json
{
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "This PDF was already uploaded as instrument #4821",
    "timestamp": "2026-05-31T02:14:22Z",
    "request_id": "req_abc123"
  }
}
```

Error codes:
```
DUPLICATE_DOCUMENT         — PDF hash already exists
INVALID_FILE_TYPE          — Not a PDF
FILE_TOO_LARGE             — Exceeds 50MB limit
REGULATOR_NOT_FOUND        — Invalid regulator_id
TENANT_NOT_FOUND           — Invalid tenant_id
INVALID_WEBHOOK_SIGNATURE  — Webhook verification failed
CLASSIFICATION_FAILED      — AI classifier returned invalid response
OCR_FAILED                 — Both PDFBox and Tesseract failed
UNAUTHORIZED               — Insufficient role permissions
```


---

## 2 — Data Models

### 2.1 Central Platform Schema


## Table 1: `regulators`

Metadata about the 43+ regulatory bodies that issue obligations in Nigeria.

```sql
CREATE TABLE regulators (
  regulator_id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,           -- e.g. "Central Bank of Nigeria"
  abbreviation VARCHAR(20) NOT NULL,    -- e.g. "CBN"
  website_url TEXT,                     -- e.g. "https://www.cbn.gov.ng"
  publication_page_url TEXT,            -- e.g. /Out/Circulars
  scraper_enabled BOOLEAN DEFAULT true, -- Is horizon-service scraping this?
  scraper_frequency VARCHAR(50),        -- e.g. "daily", "weekly"
  contact_email VARCHAR(255),
  last_scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example rows:**
```
regulator_id | name | abbreviation | website_url | scraper_enabled
1            | Central Bank of Nigeria | CBN | https://cbn.gov.ng | true
2            | Securities and Exchange Commission | SEC | https://sec.gov.ng | true
3            | National Insurance Commission | NAICOM | https://naicom.gov.ng | true
43           | Lagos State Government | LASG | https://mirs.lagosstate.gov.ng | true
```

---

## Table 2: `instrument_types`

The types of regulatory documents. Each type carries different legal weight and urgency.

```sql
CREATE TABLE instrument_types (
  type_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,        -- e.g. "Circular", "Act", "Guideline"
  description TEXT,
  legal_weight INT DEFAULT 5,        -- 1=lowest (guidance) to 10=highest (Act)
  mandatory BOOLEAN DEFAULT false,   -- Can banks choose to ignore this?
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example rows:**
```
type_id | name | legal_weight | mandatory
1       | Act | 10 | true
2       | Regulation | 9 | true
3       | Circular | 8 | true
4       | Guideline | 5 | false
5       | Exposure Draft | 2 | false
```

---

## Table 3: `instruments` (The Master Registry of Laws)

Every law, circular, and guideline the platform knows about. This is what the scraper populates, what the AI classifier enhances, and what tenants consume.

```sql
CREATE TABLE instruments (
  instrument_id BIGINT PRIMARY KEY,
  regulator_id INT NOT NULL REFERENCES regulators(regulator_id),
  type_id INT NOT NULL REFERENCES instrument_types(type_id),
  
  -- Identity
  source_title VARCHAR(500) NOT NULL,        -- Exact title from the regulator
  source_reference_number VARCHAR(100),      -- e.g. "CBN/PD/CIR/GEN/16/2026"
  
  -- Dates
  date_issued DATE NOT NULL,                 -- When regulator published it
  date_commencement DATE,                    -- When it takes effect
  date_superseded DATE,                      -- If repealed, when
  
  -- Classification (populated by AI)
  area_of_focus VARCHAR(255),                -- e.g. "AML/CFT", "Cash Management"
  theme_id INT,                              -- Links to theme table (below)
  nature VARCHAR(50),                        -- Core / Secondary / Guidance
  risk_rating VARCHAR(20),                   -- High / Medium / Low (platform view)
  
  -- Applicability (the key routing logic)
  licence_types_applicable TEXT[],           -- e.g. ['Commercial Bank', 'Merchant Bank']
  entity_categories_applicable TEXT[],       -- e.g. ['Deposit-taking', 'Financial Services']
  product_lines_applicable TEXT[],           -- e.g. ['Retail Banking', 'Consumer Credit']
  geographic_scope VARCHAR(100),             -- "Nigeria-wide", "specific states", etc.
  applicability_confidence FLOAT,            -- 0.0 to 1.0 — how sure are we about the above?
  applicability_notes TEXT,                  -- Nuances the AI detected
  
  -- Document storage
  pdf_url TEXT,                              -- Link to original PDF (S3)
  pdf_ocr_text TEXT,                         -- Full text extracted via OCR
  pdf_hash VARCHAR(64),                      -- SHA256 for deduplication
  
  -- Status
  status VARCHAR(50) DEFAULT 'Published',    -- Triage / Published / Superseded / Withdrawn
  platform_owner_id INT,                     -- Which admin/user owns this at the platform?
  
  -- Audit
  discovered_at TIMESTAMP NOT NULL,          -- When the scraper found it
  first_published_at TIMESTAMP,              -- When platform first published it to tenants
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexing for query performance
  INDEX idx_regulator_date (regulator_id, date_issued DESC),
  INDEX idx_status (status),
  INDEX idx_area_of_focus (area_of_focus),
  INDEX idx_applicability_confidence (applicability_confidence DESC)
);
```

**Example row (one circular):**
```
instrument_id: 4821
regulator_id: 1 (CBN)
type_id: 3 (Circular)
source_title: "Re: Guidelines on ATM Cash Disbursement Operations"
date_issued: 2026-05-28
date_commencement: 2026-07-01
area_of_focus: "Cash Management"
theme_id: 12
nature: "Core"
risk_rating: "High"
licence_types_applicable: ['Commercial Bank', 'Merchant Bank']
applicability_confidence: 0.97
status: "Published"
discovered_at: 2026-05-31T02:14:22Z
first_published_at: 2026-06-01T08:30:00Z
```

**Why this structure matters:**
- The `licence_types_applicable` and `product_lines_applicable` arrays allow the platform to filter which tenants need this obligation
- `applicability_confidence` tells the tenant "this is definitely applicable" (0.95+) or "you should review" (0.4-0.6)
- `discovered_at` vs `first_published_at` shows the platform can detect something and hold it for review before pushing it to tenants

---

## Table 4: `themes`

Compliance domains. Used to organize obligations and route them to relevant teams.

```sql
CREATE TABLE themes (
  theme_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,        -- e.g. "AML/CFT", "Corporate Governance"
  description TEXT,
  owner_team VARCHAR(100),           -- Which compliance team normally owns this?
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example rows:**
```
theme_id | name | owner_team
1 | AML/CFT | Compliance - Financial Crime
2 | Corporate Governance | Compliance - Governance
3 | Cash Management | Compliance - Operations
4 | Data Protection | Compliance - Data Protection
... (12 total)
```

---

## Table 5: `sanctions_and_penalties` (The Consequences KB)

For every instrument, what is the fine or sanction for non-compliance?

```sql
CREATE TABLE sanctions_and_penalties (
  sanction_id BIGINT PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(instrument_id),
  
  -- What is the consequence?
  sanction_type VARCHAR(100),                 -- Fine / Licence Suspension / Public Censure
  sanction_amount_naira DECIMAL(15, 2),       -- ₦ amount, if applicable
  sanction_amount_per_day BOOLEAN,            -- Is it per diem (₦1m per day)?
  
  -- Who is personally liable?
  liable_roles TEXT[],                        -- e.g. ['MD', 'CCO', 'Board']
  personal_liability_naira DECIMAL(15, 2),    -- Personal fine amounts
  
  -- Severity
  severity_score INT (1-10),                  -- 1=low warning, 10=licence revoked
  has_been_enforced BOOLEAN,                  -- Has CBN/SEC actually fined for this?
  recent_enforcement_date DATE,               -- Last known enforcement
  recent_enforcement_amount DECIMAL(15, 2),   -- How much was the last fine?
  
  -- Details
  description TEXT,                           -- Plain English description
  source_section_reference TEXT,              -- e.g. "Section 9(4) of the Regulation"
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example row:**
```
sanction_id: 9401
instrument_id: 4821 (ATM circular)
sanction_type: "Fine per branch"
sanction_amount_naira: 1000000.00
liable_roles: ['MD', 'Head Operations', 'CCO']
severity_score: 8
has_been_enforced: true
recent_enforcement_date: 2025-11-15
recent_enforcement_amount: 3500000.00 (3 branches × ₦1m + investigation costs)
description: "₦1,000,000 per branch per incident of non-compliance with ATM cash requirements"
```

---

## Table 6: `obligation_mappings`

Links instruments to the specific obligations they create. One instrument can create multiple distinct obligations.

```sql
CREATE TABLE obligation_mappings (
  obligation_id BIGINT PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(instrument_id),
  
  -- What specifically must the bank do?
  obligation_number INT,                     -- 1st obligation in this instrument, 2nd, etc.
  plain_english_statement TEXT NOT NULL,     -- e.g. "ATMs must be funded within 24 hours"
  specific_section_reference VARCHAR(100),   -- e.g. "Section 4.2"
  
  -- Granular classification
  obligation_type VARCHAR(100),              -- "Operational", "Reporting", "Governance"
  key_terms TEXT[],                          -- e.g. ['ATM', '24 hours', 'funding']
  
  -- Compliance deadline
  compliance_deadline_days INT,              -- Days from commencement to comply
  recurring_deadline_type VARCHAR(50),       -- "Daily", "Monthly", "Annual", "One-time"
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example rows (one circular might have 3 obligations):**
```
obligation_id: 101
instrument_id: 4821
obligation_number: 1
plain_english_statement: "All ATMs must be funded within 24 hours of cash depletion"
specific_section_reference: "Section 4.1"
obligation_type: "Operational"
recurring_deadline_type: "Continuous"

obligation_id: 102
instrument_id: 4821
obligation_number: 2
plain_english_statement: "Banks must report ATM downtime exceeding 48 hours to CBN"
specific_section_reference: "Section 5.2"
obligation_type: "Reporting"
recurring_deadline_type: "As needed"
```

---

## Table 7: `regulatory_change_log`

Audit trail of every change to instruments and obligations. Critical for compliance and transparency.

```sql
CREATE TABLE regulatory_change_log (
  change_id BIGINT PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(instrument_id),
  
  -- What changed?
  change_type VARCHAR(100),                  -- Created / Updated / Superseded / Withdrawn
  field_name VARCHAR(100),                   -- e.g. "applicability_confidence", "status"
  old_value TEXT,
  new_value TEXT,
  
  -- Who and when?
  changed_by_user_id INT,                    -- Platform admin
  changed_by_source VARCHAR(50),             -- "scraper", "ai_classifier", "manual_admin"
  changed_at TIMESTAMP DEFAULT NOW(),
  
  -- Why?
  reason TEXT,                               -- e.g. "ISA 2025 implementation rules released"
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Table 8: `tenant_eligibility_rules`

Pre-computed rules for efficient routing. Asks: "Which tenants should receive this instrument?"

```sql
CREATE TABLE tenant_eligibility_rules (
  rule_id BIGINT PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(instrument_id),
  
  -- The rule itself
  rule_condition VARCHAR(500),               -- SQL-like: "licence_type='Commercial Bank' AND 'Retail' IN product_lines"
  target_tenant_count INT,                   -- How many tenants match? (pre-computed for efficiency)
  
  -- Routing metadata
  should_route BOOLEAN DEFAULT true,         -- Should this go to matched tenants?
  route_with_confidence_level VARCHAR(50),   -- "High" (>0.9) / "Medium" / "Low"
  route_with_review_flag BOOLEAN,            -- Should tenants review applicability?
  
  last_evaluated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example:**
```
rule_id: 501
instrument_id: 4821
rule_condition: "licence_type IN ('Commercial Bank', 'Merchant Bank')"
target_tenant_count: 18
should_route: true
route_with_confidence_level: "High"
route_with_review_flag: false
```

---

## The Intelligence Flow (How It All Works Together)

### Step 1: Scraper detects new document
```
1. horizon-service finds new PDF on CBN website
2. Inserts into instruments table with status='Triage', discovered_at=NOW()
3. Publishes 'instrument.discovered' event
```

### Step 2: AI classifier enhances it
```
1. ai-classifier-service consumes the event
2. Reads pdf_ocr_text, extracts:
   - area_of_focus
   - licence_types_applicable
   - risk_rating
   - Creates obligation_mappings rows (breaks the circular into specific duties)
3. Updates instruments table: status='Published'
4. Creates obligation_mappings rows for each distinct obligation
5. Publishes 'instrument.classified' event
```

### Step 3: Evaluate applicability
```
1. applicability-service consumes 'instrument.classified'
2. Queries sanctions_and_penalties to enrich the obligation
3. Creates tenant_eligibility_rules row
4. Computes: applicability_confidence = semantic_match_score × enforcement_history
5. Pre-computes which tenants match the routing rule
6. Updates instruments.applicability_confidence
```

### Step 4: Route to tenants
```
1. router-service consumes 'instrument.classified'
2. Looks up tenant_eligibility_rules for this instrument
3. Queries tenants: SELECT * WHERE <rule_condition>
4. For each matching tenant:
   a. Create a row in tenant.received_obligations (tenant-specific)
   b. Send webhook: POST /tenant/{tenant_id}/obligations
5. Publishes 'instrument.routed_to_tenants' event (with metrics: 18 tenants received)
```

---

## Key Queries the Platform Runs (Frequently)

```sql
-- Which tenants should receive this new circular?
SELECT t.tenant_id, t.name
FROM tenants t
WHERE t.licence_type = ANY(
  SELECT licence_types_applicable
  FROM instruments
  WHERE instrument_id = 4821
)
AND t.is_active = true;

-- What is the total compliance exposure for a theme?
SELECT 
  COUNT(*) as total_obligations,
  COUNT(CASE WHEN risk_rating='High' THEN 1 END) as high_risk,
  SUM(COALESCE(sp.sanction_amount_naira, 0)) as total_penalty_exposure
FROM instruments i
LEFT JOIN sanctions_and_penalties sp USING (instrument_id)
WHERE i.theme_id = 1 AND i.status = 'Published';

-- Which instruments changed applicability in the last 7 days?
SELECT i.*, rcl.change_type, rcl.old_value, rcl.new_value, rcl.changed_at
FROM instruments i
JOIN regulatory_change_log rcl USING (instrument_id)
WHERE rcl.field_name = 'applicability_confidence'
  AND rcl.changed_at >= NOW() - INTERVAL 7 days
ORDER BY rcl.changed_at DESC;
```

---

## Size and Scale

For Nigeria with 43 regulators, 10 years of regulations, and ~350 active obligations:

```
instruments table: ~850 rows (some repealed, some in draft)
obligation_mappings: ~2,100 rows (average 2.5 per instrument)
sanctions_and_penalties: ~1,200 rows (most instruments have multiple penalties)
regulatory_change_log: ~5,000 rows (history of updates)
```

This is small enough to fit entirely in memory if needed, but lives in PostgreSQL for durability and queryability.

---

## Critical Design Notes

1. **The platform is read-heavy for tenants.** Tenants query instruments, not write to them. All writes happen at the platform layer.

2. **Applicability is deterministic at the platform layer.** The platform decides which tenants get which obligations, based on tenant profile attributes. No guessing.

3. **Confidence scores prevent false positives.** An obligation with 0.40 confidence goes to all tenants flagged "REVIEW REQUIRED". One with 0.95 confidence goes only to explicitly matched tenants.

4. **Regulatory change is immutable.** Every change is logged in regulatory_change_log. Tenants can audit why an obligation's applicability changed on a specific date.

5. **Foreign keys are intentional but light.** Instruments → Regulators and Themes are strongly enforced. Sanctions → Instruments are 1:N but loosely coupled (an instrument might have no sanctions if it is just guidance).


### 2.2 Tenant Schema


## Pre-Requisite: Tenant Registry (Central, But Minimal)

The platform must know who the tenants are. This lives centrally.

```sql
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY,
  
  -- Identity
  legal_name VARCHAR(500) NOT NULL,
  short_name VARCHAR(100),
  
  -- Regulatory profile (used for applicability routing)
  licence_type VARCHAR(100) NOT NULL,        -- "Commercial Bank", "Fintech", "PFA", etc.
  licence_number VARCHAR(100),
  cbx_registration_number VARCHAR(100),      -- CBN registration
  
  -- What regulators oversee this tenant?
  regulators TEXT[] NOT NULL,                -- e.g. ['CBN', 'SEC', 'NDPC']
  
  -- What business does it do?
  product_lines TEXT[],                      -- e.g. ['Retail Banking', 'Consumer Credit']
  employees_count INT,                       -- For NDPA DPO exemptions
  geographic_scope VARCHAR(100),             -- "Nigeria", "West Africa", etc.
  
  -- Contact
  cco_email VARCHAR(255),                    -- Chief Compliance Officer
  cco_name VARCHAR(255),
  tech_contact_email VARCHAR(255),
  
  -- Subscription
  subscription_tier VARCHAR(50),             -- Starter / Pro / Enterprise
  is_active BOOLEAN DEFAULT true,
  onboarded_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_licence_type (licence_type),
  INDEX idx_regulators (regulators)
);
```

---

## TENANT-SIDE SCHEMA

Everything below lives in the tenant's own isolated database. The central platform cannot access any of it.

---

## Table 1: `received_obligations` (Tenant's Copy)

When the platform publishes an obligation, it sends a webhook. The tenant receives it here.

```sql
CREATE TABLE received_obligations (
  obligation_id BIGINT PRIMARY KEY,
  
  -- Reference to central platform
  platform_obligation_id BIGINT NOT NULL,    -- FK back to central instruments table (for reference only)
  platform_received_at TIMESTAMP NOT NULL,   -- When the webhook arrived
  
  -- The obligation itself (copied from platform for offline access)
  source_title VARCHAR(500) NOT NULL,
  regulator VARCHAR(100),
  instrument_type VARCHAR(50),
  area_of_focus VARCHAR(255),
  theme VARCHAR(100),
  nature VARCHAR(50),                        -- Core / Secondary / Guidance
  platform_risk_rating VARCHAR(20),          -- How the platform rated it
  
  -- Tenant's assessment
  is_applicable BOOLEAN DEFAULT NULL,        -- NULL = not yet decided, true = yes, false = no
  tenant_applicability_reasoning TEXT,       -- Why did we decide this applies/doesn't apply?
  tenant_risk_rating VARCHAR(20),            -- Tenant may override platform rating
  tenant_risk_rating_reasoning TEXT,
  
  -- Ownership
  assigned_owner_user_id INT,                -- The named person responsible for this obligation
  assigned_owner_name VARCHAR(255),
  assigned_owner_department VARCHAR(100),
  assigned_at TIMESTAMP,
  
  -- Dates
  date_issued DATE,
  date_commencement DATE,
  compliance_deadline_days INT,              -- Days to comply from commencement
  
  -- Links to tenant's controls (below)
  linked_control_ids INT[],                  -- ForeignKey to controls table (below)
  has_control BOOLEAN,                       -- Does tenant have a control for this?
  
  -- Status
  status VARCHAR(50) DEFAULT 'Received',     -- Received → Classified → Active/Inapplicable → Superseded
  tenant_owner_id INT,                       -- Tenant's user who made the final call
  decided_at TIMESTAMP,
  
  -- Audit
  audit_hash VARCHAR(64),                    -- Hash of this row for tamper detection
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_is_applicable (is_applicable),
  INDEX idx_status (status),
  INDEX idx_assigned_owner (assigned_owner_user_id),
  INDEX idx_linked_controls (linked_control_ids)
);
```

**Example row:**
```
obligation_id: 4821
platform_obligation_id: 4821 (same, for reference)
source_title: "Re: Guidelines on ATM Cash Disbursement Operations"
regulator: "Central Bank of Nigeria"
area_of_focus: "Cash Management"
platform_risk_rating: "High"
is_applicable: true (decided by GTB)
tenant_applicability_reasoning: "GTB operates ATMs across 500+ branches. This is core to our operations."
tenant_risk_rating: "High"
assigned_owner_user_id: 123 (Emeka Obi)
assigned_owner_name: "Emeka Obi"
assigned_owner_department: "Operations Compliance"
linked_control_ids: [44, 45] (controls CTRL-044 and CTRL-045)
status: "Active"
decided_at: 2026-06-02 11:32:00
```

---

## Table 2: `controls` (The Tenant's Risk Mitigations)

Every control the tenant has built to comply with regulations. A control is a real, measurable activity — not an intention.

```sql
CREATE TABLE controls (
  control_id INT PRIMARY KEY,
  
  -- Identity
  control_number VARCHAR(50) NOT NULL,       -- e.g. "CTRL-044"
  name VARCHAR(255) NOT NULL,                -- e.g. "Monthly ATM Cash Monitoring"
  description TEXT,
  
  -- Categorisation
  theme_id INT,                              -- Which compliance domain? (AML, Cash, etc.)
  theme_name VARCHAR(100),
  control_type VARCHAR(100),                 -- "Manual Review", "Automated System", "Process"
  
  -- The substance
  what_it_does TEXT NOT NULL,                -- Plain English: what does this control do?
  how_it_works TEXT,                         -- How is it executed? Steps?
  how_tested TEXT,                           -- How do you verify it's working?
  
  -- Owner and frequency
  control_owner_id INT NOT NULL,             -- Person responsible for this control
  control_owner_name VARCHAR(255),
  control_owner_department VARCHAR(100),
  
  test_frequency VARCHAR(50),                -- Monthly / Quarterly / Annual / Ad-hoc
  test_frequency_days INT,                   -- Calculated: e.g. 30 for monthly
  
  -- Linked obligations
  linked_obligation_ids BIGINT[],            -- Which obligations does this control address?
  
  -- Risk rating
  inherent_risk VARCHAR(20),                 -- Risk without this control (High/Med/Low)
  residual_risk VARCHAR(20),                 -- Risk with this control working (High/Med/Low)
  
  -- Status
  status VARCHAR(50) DEFAULT 'Active',       -- Active / Needs Improvement / Ineffective / New
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id INT,
  
  INDEX idx_control_owner (control_owner_id),
  INDEX idx_theme (theme_id),
  INDEX idx_test_frequency (test_frequency)
);
```

**Example rows:**
```
control_id: 44
control_number: "CTRL-044"
name: "Monthly ATM Cash Monitoring"
description: "Manual review of ATM cash logs to ensure all ATMs are refilled within 24 hours of depletion"
theme_name: "Cash Management"
control_type: "Manual Review"
control_owner_name: "Emeka Obi"
control_owner_department: "Operations Compliance"
test_frequency: "Monthly"
linked_obligation_ids: [4821]
inherent_risk: "High"
residual_risk: "Low" (when the control works)
status: "Active"

control_id: 45
control_number: "CTRL-045"
name: "Automated ATM Cash Alert System"
description: "System automatically flags any ATM below 20% cash for more than 4 hours"
control_type: "Automated System"
control_owner_name: "Head, IT Operations"
test_frequency: "Monthly"
linked_obligation_ids: [4821]
inherent_risk: "High"
residual_risk: "Low"
status: "Active"
```

---

## Table 3: `control_test_results`

Every time a control is tested, the result is recorded here. This is the evidence trail.

```sql
CREATE TABLE control_test_results (
  test_id BIGINT PRIMARY KEY,
  control_id INT NOT NULL REFERENCES controls(control_id),
  
  -- When and who
  test_date DATE NOT NULL,
  test_performed_by_user_id INT NOT NULL,
  test_performed_by_name VARCHAR(255),
  test_performed_by_department VARCHAR(100),
  
  -- The result
  result VARCHAR(50) NOT NULL,               -- "Passed" / "Failed" / "Partial"
  result_description TEXT,                   -- Details of what was tested and why it passed/failed
  
  -- If failed, what went wrong?
  failure_details TEXT,                      -- Specific incidents or gaps identified
  failure_severity VARCHAR(50),              -- Low / Medium / High
  
  -- Evidence
  evidence_document_url TEXT,                -- S3 link to evidence (PDF, screenshot, etc.)
  evidence_hash VARCHAR(64),                 -- SHA256 of evidence
  
  -- Review
  reviewed_by_user_id INT,                   -- Compliance team member
  reviewed_by_name VARCHAR(255),
  review_status VARCHAR(50),                 -- Pending / Accepted / Rejected
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  
  -- Remediation (if failed)
  remediation_required BOOLEAN DEFAULT false,
  remediation_owner_user_id INT,             -- Who will fix it?
  remediation_deadline DATE,
  
  -- Audit
  audit_hash VARCHAR(64),                    -- Hash for tamper detection
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_control_id (control_id),
  INDEX idx_test_date (test_date DESC),
  INDEX idx_result (result)
);
```

**Example rows:**
```
test_id: 88441
control_id: 44
test_date: 2026-01-13
test_performed_by_name: "Emeka Obi"
result: "Failed"
result_description: "3 ATMs in Lagos region (Ikeja, VI, Lekki) remained unfunded for >24 hours on Jan 11-12 due to cash forecasting system outage"
failure_details: "Ikeja: 31 hours unfunded, VI: 28 hours, Lekki: 29 hours. Root cause: cash forecasting system down Jan 11-12."
failure_severity: "High"
evidence_document_url: "s3://atheris-evidence/gtb/ctrl-044-jan-2026.pdf"
reviewed_by_name: "Ngozi Eze"
review_status: "Accepted"
reviewed_at: 2026-01-14

test_id: 88442
control_id: 44
test_date: 2026-02-13
test_performed_by_name: "Emeka Obi"
result: "Passed"
result_description: "All 500+ ATMs funded within 24 hours. Automated alert system now in place and triggered 0 alerts. No breaches."
reviewed_by_name: "Ngozi Eze"
review_status: "Accepted"
reviewed_at: 2026-02-15
```

---

## Table 4: `findings` (Gaps and Deficiencies)

When a control fails or an obligation has no control, a finding is opened.

```sql
CREATE TABLE findings (
  finding_id BIGINT PRIMARY KEY,
  
  -- What triggered it?
  triggered_by_test_id BIGINT REFERENCES control_test_results(test_id),  -- Which test?
  triggered_by_obligation_id BIGINT,        -- Or which obligation has no control?
  triggered_reason VARCHAR(100),            -- "Control test failed" / "No control exists" / "Manual discovery"
  
  -- Classification
  finding_type VARCHAR(100),                -- "Control Failure" / "Gap" / "Process Weakness"
  severity VARCHAR(50),                     -- Critical / High / Medium / Low
  
  -- Details
  description TEXT NOT NULL,                -- What is wrong?
  root_cause TEXT,                          -- Why did it happen?
  risk_exposure TEXT,                       -- What could go wrong because of this?
  
  -- Obligation context
  linked_obligation_id BIGINT,
  linked_obligation_title VARCHAR(500),
  linked_sanction_amount DECIMAL(15, 2),    -- ₦ exposure if this stays unresolved
  
  -- Owner and timeline
  assigned_to_user_id INT,                  -- Who will remediate?
  assigned_to_name VARCHAR(255),
  assigned_to_department VARCHAR(100),
  assigned_at TIMESTAMP,
  
  remediation_deadline DATE,                -- When should it be fixed?
  sla_days INT,                             -- e.g. 14 days to remediate
  
  -- Approval chain
  created_by_user_id INT,                   -- Who logged the finding?
  ccо_sign_off_user_id INT,                 -- CCO approval
  ccо_sign_off_at TIMESTAMP,
  
  -- Status
  status VARCHAR(50) DEFAULT 'Open',        -- Open / In Remediation / Remediated / Closed / Escalated
  closed_at TIMESTAMP,
  
  -- Audit
  audit_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_remediation_deadline (remediation_deadline),
  INDEX idx_linked_obligation (linked_obligation_id)
);
```

**Example:**
```
finding_id: FIND-2026-0041
triggered_by_test_id: 88441
triggered_reason: "Control test failed"
finding_type: "Control Failure"
severity: "High"
description: "CTRL-044 (ATM Cash Monitoring) failed. 3 ATMs remained unfunded for 28-31 hours in January."
root_cause: "Cash forecasting system outage on Jan 11-12. No automated alerts in place at the time."
risk_exposure: "Non-compliance with CBN ATM guidelines. Potential penalty ₦1m per branch. Reputational risk."
linked_obligation_id: 4821
linked_sanction_amount: 3000000.00 (3 branches × ₦1m)
assigned_to_name: "IT Operations Manager"
remediation_deadline: 2026-01-27
sla_days: 14
created_by_name: "Ngozi Eze"
ccо_sign_off_user_id: 567 (CCO approved)
status: "Remediated"
closed_at: 2026-02-01 10:02:00
```

---

## Table 5: `regulatory_returns` (Filing Calendar)

Every report the bank must file to regulators.

```sql
CREATE TABLE regulatory_returns (
  return_id BIGINT PRIMARY KEY,
  
  -- Identity
  return_name VARCHAR(255) NOT NULL,        -- e.g. "Monthly AML Compliance Report"
  return_abbreviation VARCHAR(50),          -- e.g. "MAR"
  
  -- Legal basis
  legal_basis_instrument_id BIGINT,         -- Which obligation requires this return?
  legal_basis_description TEXT,
  
  -- Regulators and timeline
  filing_regulator VARCHAR(100),            -- Who receives it? (CBN, SEC, NFIU, etc.)
  filing_frequency VARCHAR(50),             -- Monthly / Quarterly / Annually / Ad-hoc
  filing_frequency_days INT,                -- 30 for monthly, 90 for quarterly, etc.
  filing_due_day_of_month INT,              -- e.g. 15th of each month
  filing_deadline_offset_days INT,          -- How many days of grace after month ends?
  
  -- Submission
  submission_channel VARCHAR(100),          -- Email / Portal / SWIFT / Paper
  submission_email VARCHAR(255),            -- Where to send it?
  
  -- Owner
  return_owner_user_id INT,                 -- Person responsible
  return_owner_name VARCHAR(255),
  return_owner_department VARCHAR(100),
  
  -- Preparation workflow
  preparation_owner_user_id INT,            -- Who gathers the data?
  review_owner_user_id INT,                 -- Who reviews the draft?
  
  -- Status
  status VARCHAR(50) DEFAULT 'Scheduled',   -- Scheduled / In Preparation / In Review / Ready / Submitted
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_return_owner (return_owner_user_id),
  INDEX idx_filing_frequency (filing_frequency),
  INDEX idx_status (status)
);
```

**Example rows:**
```
return_id: 1
return_name: "Monthly AML Compliance Status Report"
filing_regulator: "CBN"
filing_frequency: "Monthly"
filing_due_day_of_month: 10
filing_deadline_offset_days: 5
return_owner_name: "Head, Compliance (AML)"
status: "Scheduled"

return_id: 2
return_name: "Annual Board Governance Attestation"
filing_regulator: "CBN"
filing_frequency: "Annually"
filing_due_day_of_month: 31
return_owner_name: "CCO"
status: "Scheduled"
```

---

## Table 6: `return_filing_instances` (Tracking Each Submission)

For each return, a row for each time it is due.

```sql
CREATE TABLE return_filing_instances (
  instance_id BIGINT PRIMARY KEY,
  return_id BIGINT NOT NULL REFERENCES regulatory_returns(return_id),
  
  -- Timeline
  due_date DATE NOT NULL,
  preparation_start_date DATE CALCULATED (due_date - INTERVAL filing_deadline_offset_days days),
  final_submission_deadline DATE,
  
  -- Current status
  status VARCHAR(50) DEFAULT 'Not Started',  -- Not Started / In Prep / In Review / Submitted / Late / Submitted Late
  
  -- Submission
  submitted_date DATE,
  submitted_by_user_id INT,
  submission_evidence_url TEXT,              -- Receipt/confirmation from regulator
  
  -- Failure
  is_overdue BOOLEAN DEFAULT false,
  days_late INT,
  escalation_level INT,                     -- 0 = on track, 1 = overdue (analyst alert), 2 = (manager escalation), 3 = (CCO escalation)
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_return_id (return_id),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status)
);
```

---

## Table 7: `audit_events` (The Immutable Evidence Log)

Every action someone takes in the system is logged here. This is the tamper-proof chain.

```sql
CREATE TABLE audit_events (
  event_id BIGINT PRIMARY KEY,
  
  -- Action details
  actor_user_id INT NOT NULL,
  actor_user_email VARCHAR(255),
  actor_user_role VARCHAR(100),
  
  action VARCHAR(100) NOT NULL,             -- "control_test_recorded", "finding_opened", "obligation_classified", etc.
  
  -- What changed?
  subject_type VARCHAR(50),                 -- "obligation", "control", "finding", "return"
  subject_id BIGINT,
  
  before_json JSONB,                        -- State before the action
  after_json JSONB,                         -- State after the action
  
  -- Evidence attachment
  evidence_url TEXT,                        -- S3 link to any document submitted with this action
  
  -- Cryptographic chain
  previous_event_id BIGINT,                 -- FK to the prior event
  previous_event_hash VARCHAR(64),          -- Hash of previous event
  this_event_hash VARCHAR(64),              -- SHA256 of this entire row (including previous_event_hash)
  
  -- Timestamp (wall-clock time, immutable)
  occurred_at TIMESTAMP NOT NULL,
  
  -- Metadata
  ip_address VARCHAR(45),                   -- For security audit
  user_agent TEXT,
  session_id VARCHAR(64),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_actor_user (actor_user_id),
  INDEX idx_action (action),
  INDEX idx_occurred_at (occurred_at DESC),
  INDEX idx_subject (subject_type, subject_id)
);
```

**Why this is critical:**
- Every cell that changes is recorded (before/after JSON)
- Cryptographic chain: each event includes the hash of the previous event
- CBN examiners can verify: "Was this control test really recorded on Jan 13?" and "Has it been tampered with?" using the hash chain
- This is the evidence pack that examiners get when they ask for proof of compliance

---

## Table 8: `user_accounts` (Tenant's Staff)

Every person who logs into the tenant's Atheris instance.

```sql
CREATE TABLE user_accounts (
  user_id INT PRIMARY KEY,
  
  -- Identity
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  
  -- Job
  department VARCHAR(100),
  job_title VARCHAR(100),
  manager_user_id INT,                      -- Who supervises this person?
  
  -- Role-based access
  role VARCHAR(50),                         -- Analyst / Manager / CCO / Auditor / Admin
  
  -- Permissions (simplified; full RBAC in production)
  can_classify_obligations BOOLEAN,
  can_test_controls BOOLEAN,
  can_approve_findings BOOLEAN,
  can_submit_returns BOOLEAN,
  can_view_audit_log BOOLEAN,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Table 9: `dashboard_snapshots` (For Board Reports)

Pre-computed aggregates for the board dashboard. Computed daily.

```sql
CREATE TABLE dashboard_snapshots (
  snapshot_id BIGINT PRIMARY KEY,
  
  snapshot_date DATE NOT NULL,
  computed_at TIMESTAMP NOT NULL,
  
  -- Headline metrics
  total_obligations_active INT,
  total_obligations_inapplicable INT,
  obligations_high_risk INT,
  obligations_medium_risk INT,
  obligations_low_risk INT,
  
  -- Control metrics
  controls_total INT,
  controls_with_passing_tests INT,
  controls_with_recent_tests INT,                -- Tested in last 90 days
  controls_inadequate INT,
  
  -- Finding metrics
  findings_open INT,
  findings_high_severity INT,
  findings_overdue_remediation INT,
  findings_closed_this_month INT,
  
  -- Return metrics
  returns_total INT,
  returns_submitted_on_time INT,
  returns_submitted_late INT,
  returns_pending INT,
  
  -- Risk metrics
  total_penalty_exposure_naira DECIMAL(18, 2),
  high_risk_penalty_exposure DECIMAL(18, 2),
  
  -- Compliance score (0-100)
  compliance_score_overall FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Key Indexes for Performance

The tenant database has limited data (compared to the central platform), but queries are frequent:

```sql
-- Quickly find what's due
CREATE INDEX idx_returns_due ON return_filing_instances(due_date) WHERE status IN ('Not Started', 'In Prep');

-- Identify gaps
CREATE INDEX idx_findings_overdue ON findings(remediation_deadline) WHERE status IN ('Open', 'In Remediation');

-- Audit trail retrieval
CREATE INDEX idx_audit_by_date_actor ON audit_events(occurred_at DESC, actor_user_id);

-- Control testing schedule
CREATE INDEX idx_control_last_test ON control_test_results(control_id, test_date DESC);
```

---

## Isolation and Encryption

**Critical:** Each tenant's database is:
1. **Physically isolated** — Different PostgreSQL instance or separate schema with row-level security (RLS)
2. **Encrypted at rest** — Full-disk encryption + column-level encryption for sensitive fields (sanction_amount, passwords, etc.)
3. **Encrypted in transit** — All webhooks and API calls use TLS 1.3 minimum
4. **Access controlled** — Only the tenant's application instance can access their database

The central platform has webhooks to send updates, but no direct SELECT access.

---

## Data Flow: From Central Platform to Tenant

```
1. Central: Publish new instrument (obligation)
   ↓
2. Router: Evaluate tenant_eligibility_rules
   ↓
3. Router: Send webhook to tenant: POST /v1/obligations/receive
   {
     "obligation_id": 4821,
     "source_title": "Re: Guidelines on ATM...",
     "regulator": "CBN",
     ...
   }
   ↓
4. Tenant: Webhook handler inserts into received_obligations
   ↓
5. Tenant: Ngozi opens dashboard, sees new obligation
   ↓
6. Tenant: Ngozi classifies it: assigns owner, links controls, decides if applicable
   ↓
7. Tenant: Audit event logged in audit_events (immutable)
   ↓
8. Tenant: Emeka (control owner) sees tasks to test the linked controls
   ↓
9. Tenant: Emeka tests CTRL-044, uploads evidence
   ↓
10. Tenant: Result inserted in control_test_results
   ↓
11. Tenant: If failed, finding auto-opened in findings table
   ↓
12. Tenant: CCO reviews finding, approves remediation plan
   ↓
13. Tenant: (later) IT fixes the system, Emeka re-tests, passes
   ↓
14. Tenant: Finding marked Remediated, closed
   ↓
15. Daily: dashboard_snapshots table updated with current compliance metrics
   ↓
16. Monthly: Board sees a live dashboard with zero manual work
```

---

## Size and Scale

For a mid-size bank like GTB:

```
received_obligations: ~350 rows (all active obligations in Nigeria)
controls: ~150 rows (controls the bank has built)
control_test_results: ~1,800 rows/year (150 controls × 12 months)
findings: ~100 rows/year (some controls fail, some gaps exist)
regulatory_returns: ~187 rows (the fixed list of returns CBN/SEC require)
return_filing_instances: ~2,244 rows/year (187 returns × 12 months)
audit_events: ~50,000 rows/year (every action logs an event)
```

All of this is reasonably sized for a modern PostgreSQL instance with standard indexing.

---

## Critical Design Notes

1. **Tenant data is truly isolated.** The central platform cannot query a tenant's control test results or findings. It can only receive reports they choose to share.

2. **Applicability is a tenant decision.** The platform says "this applies to Commercial Banks." GTB decides "yes, it applies to us" or "no, we're exempt for these reasons."

3. **Evidence is immutable.** The audit_events table with cryptographic hashing means no one can go back and change what Emeka said about the control test on Jan 13.

4. **Webhooks are the API.** The only communication from platform to tenant is webhooks (push). Tenants don't continuously poll. When something changes, the platform pushes it.

5. **Data ownership is clear.** Central platform owns regulations and applicability rules. Each tenant owns their own controls, tests, findings, and evidence.


---

## 3 — Scraper & Horizon Scanner


## What Changed From v1

| # | Improvement | Priority |
|---|---|---|
| 1 | Stream PDFs instead of byte[] | Must-do before production |
| 2 | Max PDF size protection | Must-do before production |
| 3 | Content-Type + magic byte validation | Must-do before production |
| 4 | Retry + exponential backoff (Resilience4j) | Must-do before production |
| 5 | Source provenance tracking | Short-term |
| 6 | Scraper anomaly detection | Short-term |
| 7 | Selenium → Playwright (fully implemented) | Now — replaces Selenium entirely |
| 8 | Historical backfill vs incremental monitoring | Architectural addition |

---

## Two System Modes (Architectural Addition)

The biggest change from v1 is recognising that the scraper has two completely different jobs:

```
Mode 1: INCREMENTAL MONITORING
  Purpose: Detect new documents as they are published
  Runs: Every 15 minutes
  Volume: Low (1-5 new docs per day across all regulators)
  Priority: HIGH — this is the operational pipeline
  
Mode 2: HISTORICAL BACKFILL  
  Purpose: Import the last 2-3 years of existing regulations
  Runs: Once per regulator (or on-demand by admin)
  Volume: High (hundreds of documents per regulator)
  Priority: LOW — must not block the monitoring pipeline
```

They share code (same strategies, same OCR, same classification) but are logically and operationally separate. Backfill jobs go into a separate low-priority queue so they never delay new regulation alerts to tenants.

---

## Updated Database Schema

### regulators table (additions)

```sql
-- Existing columns remain. Add these:

ALTER TABLE regulators ADD COLUMN
  scraper_strategy VARCHAR(50) DEFAULT 'html';
  -- 'html' | 'headless' | 'disabled'

ALTER TABLE regulators ADD COLUMN
  pdf_link_selector TEXT;
  -- CSS selector for PDF links
  -- e.g. "table.circulars a[href$='.pdf']"
  -- NULL = use default (find all .pdf hrefs)

ALTER TABLE regulators ADD COLUMN
  pagination_enabled BOOLEAN DEFAULT false;

ALTER TABLE regulators ADD COLUMN
  pagination_selector TEXT;
  -- CSS selector for the "Next page" button

ALTER TABLE regulators ADD COLUMN
  pagination_strategy VARCHAR(50) DEFAULT 'NEXT_BUTTON';
  -- 'NEXT_BUTTON' | 'PAGE_PARAM' | 'YEAR_FOLDERS'

ALTER TABLE regulators ADD COLUMN
  max_pages_per_run INT DEFAULT 3;

ALTER TABLE regulators ADD COLUMN
  max_pdf_size_mb INT DEFAULT 100;
  -- Per-regulator size limit. Improvement #2.

ALTER TABLE regulators ADD COLUMN
  request_headers JSONB;
  -- Custom headers e.g. { "Referer": "https://cbn.gov.ng" }

ALTER TABLE regulators ADD COLUMN
  historical_start_year INT DEFAULT 2022;
  -- For backfill: how far back to go

ALTER TABLE regulators ADD COLUMN
  scraper_notes TEXT;
  -- Admin notes e.g. "Site went down May 2026. Use manual upload."
```

### instruments table (additions)

```sql
-- Source provenance (Improvement #5)
ALTER TABLE instruments ADD COLUMN
  source_url TEXT;                   -- Direct PDF download URL

ALTER TABLE instruments ADD COLUMN
  source_page_url TEXT;              -- Which page we found it on

ALTER TABLE instruments ADD COLUMN
  source_page_snapshot_url TEXT;     -- S3 URL of HTML snapshot of the page

ALTER TABLE instruments ADD COLUMN
  source_page_hash TEXT;             -- SHA256 of that HTML page at discovery time

-- Two timestamps, not one (Improvement #8)
ALTER TABLE instruments ADD COLUMN
  published_at DATE;                 -- When the regulator actually published it
                                     -- Extracted from page content or filename

ALTER TABLE instruments ADD COLUMN
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW();
  -- When OUR SYSTEM first found it

-- Backfill flag
ALTER TABLE instruments ADD COLUMN
  is_historical_backfill BOOLEAN DEFAULT false;

ALTER TABLE instruments ADD COLUMN
  upload_source VARCHAR(50) DEFAULT 'scraper';
  -- 'scraper' | 'manual_upload' | 'backfill'

-- Deduplication index
CREATE UNIQUE INDEX idx_instruments_source_url
  ON instruments (source_url)
  WHERE source_url IS NOT NULL;
```

### backfill_jobs table (new — Improvement #8)

```sql
CREATE TABLE backfill_jobs (
  backfill_id     BIGINT PRIMARY KEY,
  regulator_id    INT NOT NULL REFERENCES regulators(regulator_id),
  
  -- Progress tracking (resumable)
  current_page    INT DEFAULT 1,
  total_pages     INT,               -- Populated as we discover pages
  documents_found INT DEFAULT 0,
  documents_queued INT DEFAULT 0,
  
  -- Timeline
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  last_activity_at TIMESTAMP,
  
  -- Status
  status          VARCHAR(50) DEFAULT 'pending',
  -- 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  
  error_message   TEXT,
  started_by      INT,               -- Admin user who triggered it
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

### scraper_run_logs table

```sql
CREATE TABLE scraper_run_logs (
  log_id            BIGINT PRIMARY KEY,
  regulator_id      INT NOT NULL REFERENCES regulators(regulator_id),
  mode              VARCHAR(50) DEFAULT 'monitoring',  -- 'monitoring' | 'backfill'
  run_at            TIMESTAMP NOT NULL,
  documents_found   INT DEFAULT 0,
  new_documents     INT DEFAULT 0,
  skipped_documents INT DEFAULT 0,
  failed_documents  INT DEFAULT 0,
  status            VARCHAR(50),   -- 'success' | 'partial_failure' | 'failed'
  error_message     TEXT,
  duration_ms       INT,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

## Dependencies (pom.xml)

```xml
<!-- JSoup: HTML parsing for static sites -->
<dependency>
    <groupId>org.jsoup</groupId>
    <artifactId>jsoup</artifactId>
    <version>1.17.2</version>
</dependency>

<!-- Playwright: headless browser for JS-rendered sites -->
<!-- Replaces Selenium entirely. Bundles its own browser — no ChromeDriver needed. -->
<dependency>
    <groupId>com.microsoft.playwright</groupId>
    <artifactId>playwright</artifactId>
    <version>1.44.0</version>
</dependency>

<!-- Resilience4j: retry + backoff (Improvement #4) -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
</dependency>

<!-- PDFBox: validate PDFs, extract text -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.2</version>
</dependency>
```

---

## ScraperService.java (Updated)

```java
@Service
@Slf4j
public class ScraperService {

    @Autowired private RegulatorRepository regulators;
    @Autowired private ScraperRunLogRepository scraperLogs;
    @Autowired private InstrumentRepository instruments;
    @Autowired private StorageService storage;
    @Autowired private JobQueueService jobQueue;
    @Autowired private HtmlScraperStrategy htmlStrategy;
    @Autowired private PlaywrightHeadlessStrategy headlessStrategy;

    // ─────────────────────────────────────────────────────────────────
    // MODE 1: INCREMENTAL MONITORING
    // Called by cron every 15 minutes
    // ─────────────────────────────────────────────────────────────────

    public void scrapeAllDue() {
        List<Regulator> active = regulators.findAllActive();
        for (Regulator regulator : active) {
            if (!regulator.isScraperEnabled()) continue;
            if (!isDue(regulator)) continue;

            try {
                scrape(regulator, ScrapeMode.MONITORING);
            } catch (Exception e) {
                log.error("Scraper failed for {}: {}", regulator.getAbbreviation(), e.getMessage());
                logRun(regulator, ScrapeMode.MONITORING, 0, 0, 0, e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // MODE 2: HISTORICAL BACKFILL
    // Called by admin or resumed by cron
    // ─────────────────────────────────────────────────────────────────

    public void runBackfill(Long regulatorId, Long backfillJobId) {
        Regulator regulator = regulators.findById(regulatorId)
            .orElseThrow(() -> new NotFoundException("Regulator not found"));
        BackfillJob job = backfillJobs.findById(backfillJobId)
            .orElseThrow(() -> new NotFoundException("Backfill job not found"));

        backfillJobs.markRunning(backfillJobId);
        log.info("Starting backfill for {} from page {}", 
            regulator.getAbbreviation(), job.getCurrentPage());

        try {
            scrape(regulator, ScrapeMode.BACKFILL, job);
            backfillJobs.markCompleted(backfillJobId);
        } catch (Exception e) {
            log.error("Backfill failed for {} at page {}: {}", 
                regulator.getAbbreviation(), job.getCurrentPage(), e.getMessage());
            backfillJobs.markFailed(backfillJobId, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CORE SCRAPE METHOD
    // ─────────────────────────────────────────────────────────────────

    public ScraperRunResult scrape(Regulator regulator, ScrapeMode mode) {
        return scrape(regulator, mode, null);
    }

    public ScraperRunResult scrape(Regulator regulator, ScrapeMode mode, BackfillJob backfillJob) {
        long startTime = System.currentTimeMillis();
        log.info("[{}] Starting {} scrape for {}",
            mode, regulator.getAbbreviation(), regulator.getPublicationPageUrl());

        // For backfill, resume from where we left off
        int startPage = backfillJob != null ? backfillJob.getCurrentPage() : 1;

        // Find PDF links
        List<PdfLink> foundLinks = findPdfLinks(regulator, startPage);
        log.info("[{}] Found {} PDF links on {}", 
            mode, foundLinks.size(), regulator.getPublicationPageUrl());

        int newCount = 0;
        int skippedCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        for (PdfLink link : foundLinks) {
            try {
                if (alreadyProcessed(link.getUrl())) {
                    skippedCount++;
                    continue;
                }

                processNewDocument(link, regulator, mode);
                newCount++;

                // Update backfill progress (for resumability)
                if (backfillJob != null) {
                    backfillJobs.updateProgress(backfillJob.getBackfillId(),
                        backfillJob.getCurrentPage(),
                        backfillJob.getDocumentsQueued() + 1);
                }

            } catch (PdfTooLargeException e) {
                log.warn("PDF too large, skipping: {}", link.getUrl());
                skippedCount++;
            } catch (InvalidContentTypeException e) {
                log.warn("Not a PDF, skipping: {}", link.getUrl());
                skippedCount++;
            } catch (Exception e) {
                log.error("Error processing {}: {}", link.getUrl(), e.getMessage());
                errors.add(link.getUrl() + ": " + e.getMessage());
                failedCount++;
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        ScraperRunLog runLog = logRun(regulator, mode, foundLinks.size(),
            newCount, failedCount,
            errors.isEmpty() ? null : String.join("; ", errors));
        runLog.setDurationMs((int) duration);

        regulators.updateLastRan(regulator.getRegulatorId(), Instant.now(), newCount);

        log.info("[{}] Scrape done for {}. Found: {}, New: {}, Skipped: {}, Failed: {}, Time: {}ms",
            mode, regulator.getAbbreviation(), foundLinks.size(), 
            newCount, skippedCount, failedCount, duration);

        return ScraperRunResult.builder()
            .regulatorId(regulator.getRegulatorId())
            .mode(mode.name())
            .foundLinks(foundLinks.size())
            .newDocuments(newCount)
            .skippedDocuments(skippedCount)
            .failedDocuments(failedCount)
            .errors(errors)
            .durationMs((int) duration)
            .build();
    }

    // ─────────────────────────────────────────────────────────────────
    // PROCESS ONE DOCUMENT
    // All reliability improvements applied here
    // ─────────────────────────────────────────────────────────────────

    private void processNewDocument(PdfLink link, Regulator regulator, ScrapeMode mode)
        throws Exception {

        long maxBytes = (long) regulator.getMaxPdfSizeMb() * 1024 * 1024;

        // IMPROVEMENT #2 + #3 + #1: Check size, content type, and stream
        // ─────────────────────────────────────────────────────────────
        // We do a HEAD request first to check Content-Length and Content-Type
        // before committing to a full download
        HttpResponse<Void> headResponse = httpClient.send(
            HttpRequest.newBuilder()
                .uri(URI.create(link.getUrl()))
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", SCRAPER_USER_AGENT)
                .build(),
            HttpResponse.BodyHandlers.discarding()
        );

        // IMPROVEMENT #3: Content-Type validation BEFORE downloading
        String contentType = headResponse.headers()
            .firstValue("Content-Type")
            .orElse("unknown");

        if (!contentType.toLowerCase().contains("pdf")
            && !contentType.contains("octet-stream")) {
            throw new InvalidContentTypeException(
                "Expected PDF but got Content-Type: " + contentType
            );
        }

        // IMPROVEMENT #2: Size check BEFORE downloading
        long contentLength = headResponse.headers()
            .firstValueAsLong("Content-Length")
            .orElse(-1);

        if (contentLength > maxBytes) {
            throw new PdfTooLargeException(String.format(
                "PDF size %d MB exceeds limit of %d MB for regulator %s",
                contentLength / (1024 * 1024),
                regulator.getMaxPdfSizeMb(),
                regulator.getAbbreviation()
            ));
        }

        // IMPROVEMENT #5: Snapshot the source page HTML BEFORE downloading the PDF
        // This preserves provenance — proof that this document WAS on that page
        String pageSnapshotUrl = snapshotSourcePage(link.getDiscoveredOnPage(), regulator);
        String pageHash = sha256Hex(pageSnapshotUrl.getBytes());

        // IMPROVEMENT #4: Retry with exponential backoff for the actual download
        String s3Url = downloadWithRetry(link.getUrl(), regulator, maxBytes);

        // Compute hash from S3 metadata (was computed during streaming upload)
        String pdfHash = storage.getMetadataHash(s3Url);

        // IMPROVEMENT #3: Double-check magic bytes by reading first 4 bytes from S3
        byte[] header = storage.readFirstBytes(s3Url, 4);
        if (!isPdfMagicBytes(header)) {
            storage.delete(s3Url);  // Clean up invalid file
            throw new InvalidContentTypeException("File does not start with %PDF magic bytes");
        }

        // Check for same content under different URL (hash dedup)
        if (instruments.existsByPdfHash(pdfHash)) {
            log.info("Duplicate content (hash match), skipping: {}", link.getUrl());
            storage.delete(s3Url);  // Clean up duplicate
            return;
        }

        // Enqueue OCR job
        // Backfill jobs go in with LOW priority so they don't block monitoring
        int priority = mode == ScrapeMode.MONITORING ? 1 : 0;

        jobQueue.enqueue(
            JobType.OCR_DOCUMENT,
            null,
            priority,
            Map.of(
                "regulator_id",            regulator.getRegulatorId(),
                "pdf_s3_url",              s3Url,
                "source_url",              link.getUrl(),
                "source_page_url",         link.getDiscoveredOnPage(),
                "source_page_snapshot_url", pageSnapshotUrl,
                "source_page_hash",        pageHash,
                "title",                   link.getTitle(),
                "pdf_hash",                pdfHash,
                "is_historical_backfill",  mode == ScrapeMode.BACKFILL,
                "discovered_at",           Instant.now().toString()
            )
        );

        log.info("[{}] Queued: {} ({})", mode, link.getTitle(), link.getUrl());
    }

    // ─────────────────────────────────────────────────────────────────
    // IMPROVEMENT #1: STREAMING DOWNLOAD WITH SHA256
    // Never loads full PDF into memory
    // ─────────────────────────────────────────────────────────────────

    private String downloadWithRetry(String url, Regulator regulator, long maxBytes) {
        // Resilience4j retry config (Improvement #4)
        RetryConfig retryConfig = RetryConfig.custom()
            .maxAttempts(3)
            .waitDuration(Duration.ofSeconds(2))
            .intervalFunction(IntervalFunction.ofExponentialBackoff(
                Duration.ofSeconds(2), 2.0))  // 2s, 4s, 8s
            .retryExceptions(
                IOException.class,
                TimeoutException.class
            )
            .ignoreExceptions(
                // DO NOT retry these — they are permanent failures
                InvalidContentTypeException.class,
                PdfTooLargeException.class
            )
            .build();

        Retry retry = Retry.of("pdfDownload-" + regulator.getAbbreviation(), retryConfig);

        return Retry.decorateCheckedSupplier(retry, () ->
            streamDownloadToS3(url, regulator, maxBytes)
        ).get();
    }

    private String streamDownloadToS3(String url, Regulator regulator, long maxBytes)
        throws Exception {

        // Build request with regulator-specific headers
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(60))
            .header("User-Agent", SCRAPER_USER_AGENT)
            .GET();

        if (regulator.getRequestHeaders() != null) {
            regulator.getRequestHeaders().fields().forEachRemaining(entry ->
                builder.header(entry.getKey(), entry.getValue().asText())
            );
        }

        // IMPROVEMENT #1: Get InputStream, not byte[]
        HttpResponse<InputStream> response = httpClient.send(
            builder.build(),
            HttpResponse.BodyHandlers.ofInputStream()
        );

        if (response.statusCode() != 200) {
            // Only retry on 5xx (server errors), not 4xx (client errors)
            if (response.statusCode() >= 500) {
                throw new IOException("HTTP " + response.statusCode() + " (server error, will retry)");
            } else {
                throw new InvalidContentTypeException(
                    "HTTP " + response.statusCode() + " (client error, will not retry): " + url
                );
            }
        }

        // IMPROVEMENT #1: Stream through DigestInputStream → S3
        // SHA256 is computed ON THE FLY as the stream is uploaded
        // Zero additional memory allocation beyond the stream buffer

        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        try (InputStream pdfStream = response.body();
             DigestInputStream digestStream = new DigestInputStream(pdfStream, digest)) {

            String s3Key = "raw/" + regulator.getAbbreviation().toLowerCase()
                         + "/" + UUID.randomUUID() + ".pdf";

            // StorageService.upload() reads from the stream directly
            // It does NOT buffer the entire file in memory
            storage.streamUpload(digestStream, s3Key, "application/pdf", maxBytes);

            // Hash is finalized AFTER upload completes
            String hash = HexFormat.of().formatHex(digest.digest());

            // Store hash as S3 object metadata for later retrieval
            storage.setMetadataHash(s3Key, hash);

            return s3Key;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // IMPROVEMENT #5: SOURCE PROVENANCE SNAPSHOT
    // ─────────────────────────────────────────────────────────────────

    private String snapshotSourcePage(String pageUrl, Regulator regulator) {
        try {
            // Download and store the HTML of the page where we found the PDF
            // This is evidence that the document WAS on the regulator's website
            // at the time of discovery
            String html = Jsoup.connect(pageUrl)
                .userAgent(SCRAPER_USER_AGENT)
                .timeout(15_000)
                .get()
                .html();

            String date = LocalDate.now().toString();
            String key = "provenance/"
                + regulator.getAbbreviation().toLowerCase()
                + "/" + date + "/"
                + UUID.randomUUID() + ".html";

            storage.upload(html.getBytes(StandardCharsets.UTF_8), key, "text/html");

            log.debug("Page snapshot saved: {}", key);
            return key;

        } catch (Exception e) {
            // Provenance capture is best-effort. Don't fail the document for this.
            log.warn("Could not snapshot source page {}: {}", pageUrl, e.getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private boolean isPdfMagicBytes(byte[] bytes) {
        return bytes.length >= 4
            && bytes[0] == '%'
            && bytes[1] == 'P'
            && bytes[2] == 'D'
            && bytes[3] == 'F';
    }

    private boolean alreadyProcessed(String url) {
        return instruments.existsBySourceUrl(url);
    }

    private List<PdfLink> findPdfLinks(Regulator regulator, int startPage) {
        return switch (regulator.getScraperStrategy()) {
            case "html"     -> htmlStrategy.findPdfLinks(regulator, startPage);
            case "headless" -> headlessStrategy.findPdfLinks(regulator, startPage);
            default -> {
                log.warn("Unknown strategy '{}' for {}",
                    regulator.getScraperStrategy(), regulator.getAbbreviation());
                yield List.of();
            }
        };
    }

    private boolean isDue(Regulator regulator) {
        if (regulator.getScraperLastRanAt() == null) return true;
        Duration elapsed = Duration.between(regulator.getScraperLastRanAt(), Instant.now());
        return switch (regulator.getScraperFrequency()) {
            case "15min"  -> elapsed.toMinutes() >= 15;
            case "hourly" -> elapsed.toHours() >= 1;
            case "daily"  -> elapsed.toHours() >= 24;
            case "weekly" -> elapsed.toDays() >= 7;
            default       -> elapsed.toHours() >= 24;
        };
    }

    private ScraperRunLog logRun(Regulator regulator, ScrapeMode mode,
        int found, int newDocs, int failed, String error) {
        return scraperLogs.insert(ScraperRunLog.builder()
            .regulatorId(regulator.getRegulatorId())
            .mode(mode.name().toLowerCase())
            .runAt(Instant.now())
            .documentsFound(found)
            .newDocuments(newDocs)
            .failedDocuments(failed)
            .status(error == null ? "success" : (failed > 0 ? "partial_failure" : "success"))
            .errorMessage(error)
            .build());
    }

    private static final String SCRAPER_USER_AGENT =
        "Atheris-HorizonScanner/1.0 (compliance@atheris.com)";
}
```

---

## StorageService.java (Stream Upload Addition)

```java
@Service
public class StorageService {

    @Autowired private S3Client s3Client;

    @Value("${atheris.storage.bucket}")
    private String bucket;

    /**
     * IMPROVEMENT #1: Stream upload — never loads full file into memory.
     * Reads from InputStream in chunks. Safe for 100MB+ PDFs.
     *
     * @param maxBytes  If content exceeds this, abort upload and throw.
     */
    public void streamUpload(InputStream inputStream, String key,
                              String contentType, long maxBytes) throws IOException {

        // Use multipart upload for large files
        // This lets S3 receive the file in chunks
        CreateMultipartUploadResponse multipart = s3Client.createMultipartUpload(b -> b
            .bucket(bucket)
            .key(key)
            .contentType(contentType)
        );

        String uploadId = multipart.uploadId();
        List<CompletedPart> parts = new ArrayList<>();
        int partNumber = 1;
        long totalBytes = 0;
        byte[] buffer = new byte[8 * 1024 * 1024]; // 8MB chunks
        int bytesRead;

        try {
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                totalBytes += bytesRead;

                // IMPROVEMENT #2: Abort if file exceeds max size mid-stream
                if (totalBytes > maxBytes) {
                    s3Client.abortMultipartUpload(b -> b
                        .bucket(bucket).key(key).uploadId(uploadId));
                    throw new PdfTooLargeException(
                        "PDF stream exceeded maximum size of " + (maxBytes / 1024 / 1024) + "MB"
                    );
                }

                // Upload this chunk
                UploadPartResponse partResponse = s3Client.uploadPart(
                    b -> b.bucket(bucket).key(key)
                          .uploadId(uploadId).partNumber(partNumber),
                    RequestBody.fromBytes(Arrays.copyOf(buffer, bytesRead))
                );

                parts.add(CompletedPart.builder()
                    .partNumber(partNumber)
                    .eTag(partResponse.eTag())
                    .build());

                partNumber++;
            }

            // Complete the upload
            s3Client.completeMultipartUpload(b -> b
                .bucket(bucket).key(key).uploadId(uploadId)
                .multipartUpload(m -> m.parts(parts))
            );

        } catch (PdfTooLargeException e) {
            throw e; // Already aborted above
        } catch (Exception e) {
            // Abort on any other error
            s3Client.abortMultipartUpload(b -> b
                .bucket(bucket).key(key).uploadId(uploadId));
            throw new IOException("Failed to stream upload to S3: " + e.getMessage(), e);
        }
    }

    /**
     * Store hash as S3 object metadata.
     * Called after DigestInputStream finalizes the hash.
     */
    public void setMetadataHash(String key, String hash) {
        s3Client.copyObject(b -> b
            .sourceBucket(bucket).sourceKey(key)
            .destinationBucket(bucket).destinationKey(key)
            .metadata(Map.of("pdf-sha256", hash))
            .metadataDirective(MetadataDirective.REPLACE)
        );
    }

    public String getMetadataHash(String key) {
        return s3Client.headObject(b -> b.bucket(bucket).key(key))
            .metadata().getOrDefault("pdf-sha256", "");
    }

    public byte[] readFirstBytes(String key, int numBytes) {
        ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(b -> b
            .bucket(bucket).key(key)
            .range("bytes=0-" + (numBytes - 1))
        );
        return response.asByteArray();
    }
}
```

---

## IMPROVEMENT #6: Scraper Anomaly Detection

```java
@Component
@Slf4j
public class ScraperAnomalyDetector {

    @Autowired private ScraperRunLogRepository scraperLogs;
    @Autowired private RegulatorRepository regulators;
    @Autowired private AlertService alertService;

    /**
     * Runs every hour. Checks for abnormal scraper behaviour.
     * IMPROVEMENT #6: Detect when selectors silently break.
     */
    @Scheduled(fixedDelay = 3_600_000)
    public void detectAnomalies() {
        List<Regulator> activeRegulators = regulators.findAllActive();

        for (Regulator regulator : activeRegulators) {
            if (!regulator.isScraperEnabled()) continue;

            checkConsecutiveZeroRuns(regulator);
            checkDropInDocumentVolume(regulator);
        }
    }

    /**
     * Alert if 3 consecutive runs found 0 documents.
     * Most likely cause: website restructured, selector broken.
     */
    private void checkConsecutiveZeroRuns(Regulator regulator) {
        List<ScraperRunLog> recentRuns = scraperLogs
            .findLatestNRuns(regulator.getRegulatorId(), 3);

        if (recentRuns.size() < 3) return;

        boolean allZero = recentRuns.stream()
            .allMatch(run -> run.getDocumentsFound() == 0);

        if (allZero) {
            String message = String.format(
                "ALERT: %s scraper has found 0 documents for 3 consecutive runs. " +
                "Last run: %s. Possible causes: website restructured, " +
                "selector broken, site down. " +
                "Action: Check %s and update PDF selector in Admin UI.",
                regulator.getAbbreviation(),
                recentRuns.get(0).getRunAt(),
                regulator.getPublicationPageUrl()
            );

            log.warn(message);
            alertService.sendPlatformAlert(
                "Scraper Alert: " + regulator.getAbbreviation(),
                message,
                AlertSeverity.WARNING
            );
        }
    }

    /**
     * Alert if document volume drops >90% compared to historical average.
     * e.g. CBN usually finds 20 docs/week. Now finding 1.
     */
    private void checkDropInDocumentVolume(Regulator regulator) {
        // Historical average: last 30 runs
        Double historicalAvg = scraperLogs
            .averageDocumentsFound(regulator.getRegulatorId(), 30);
        if (historicalAvg == null || historicalAvg < 5) return; // Not enough data

        // Latest run
        ScraperRunLog latest = scraperLogs
            .findLatestRun(regulator.getRegulatorId());
        if (latest == null) return;

        double dropPercent = 1.0 - (latest.getDocumentsFound() / historicalAvg);

        if (dropPercent > 0.90) {
            String message = String.format(
                "ALERT: %s scraper volume dropped %.0f%%. " +
                "Historical avg: %.0f docs/run. Latest: %d docs. " +
                "Selector may be partially broken.",
                regulator.getAbbreviation(),
                dropPercent * 100,
                historicalAvg,
                latest.getDocumentsFound()
            );

            log.warn(message);
            alertService.sendPlatformAlert(
                "Scraper Volume Drop: " + regulator.getAbbreviation(),
                message,
                AlertSeverity.WARNING
            );
        }
    }
}
```

---

## Updated JobQueueProcessors.java (Two Separate Schedulers)

```java
@Component
@Slf4j
public class JobQueueProcessors {

    // ─────────────────────────────────────────────────────────────────
    // MONITORING SCRAPER (every 15 minutes)
    // High priority. Checks for new regulations.
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 900_000)  // 15 minutes
    public void runMonitoringScraper() {
        scraperService.scrapeAllDue();
    }

    // ─────────────────────────────────────────────────────────────────
    // BACKFILL PROCESSOR (every 10 minutes, LOW priority)
    // Resumes any in-progress backfill jobs.
    // Will not run if monitoring jobs are queued.
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 600_000)  // 10 minutes
    public void resumeBackfillJobs() {
        // Don't run backfill if there are pending HIGH priority jobs
        int pendingHighPriority = jobQueue.countPending(JobPriority.HIGH);
        if (pendingHighPriority > 0) {
            log.debug("Skipping backfill — {} high priority jobs pending", pendingHighPriority);
            return;
        }

        backfillJobRepository.findNextPendingJob().ifPresent(job -> {
            scraperService.runBackfill(job.getRegulatorId(), job.getBackfillId());
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // OCR PROCESSOR — processes HIGH priority first
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 120_000) // 2 minutes
    @Transactional
    public void processOcrQueue() {
        // HIGH priority first (monitoring), LOW priority second (backfill)
        jobQueue.claimOne("ocr_document", JobPriority.HIGH)
            .or(() -> jobQueue.claimOne("ocr_document", JobPriority.LOW))
            .ifPresent(job -> {
                try {
                    processOcrJob(job);
                    jobQueue.markCompleted(job.getJobId());
                } catch (Exception e) {
                    jobQueue.markFailed(job.getJobId(), e.getMessage());
                }
            });
    }

    // ─────────────────────────────────────────────────────────────────
    // CLASSIFIER (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processClassifierQueue() {
        jobQueue.claimOne("classify_instrument", JobPriority.HIGH)
            .or(() -> jobQueue.claimOne("classify_instrument", JobPriority.LOW))
            .ifPresent(job -> {
                try {
                    Long instrumentId = job.getSubjectId();
                    String ocrText = job.getPayloadField("pdf_ocr_text");
                    boolean isBackfill = job.getPayloadBoolean("is_historical_backfill");

                    classifier.classifyAsync(instrumentId, ocrText);
                    jobQueue.markCompleted(job.getJobId());
                } catch (Exception e) {
                    jobQueue.markFailed(job.getJobId(), e.getMessage());
                }
            });
    }

    // ─────────────────────────────────────────────────────────────────
    // APPLICABILITY (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processApplicabilityQueue() {
        jobQueue.claimOne("evaluate_applicability")
            .ifPresent(job -> {
                try {
                    Long instrumentId = job.getSubjectId();
                    List<String> matchedTenants = applicability.evaluate(instrumentId);
                    jobQueue.enqueue(JobType.SEND_WEBHOOKS, instrumentId,
                        Map.of("matching_tenants", matchedTenants));
                    jobQueue.markCompleted(job.getJobId());
                } catch (Exception e) {
                    jobQueue.markFailed(job.getJobId(), e.getMessage());
                }
            });
    }

    // ─────────────────────────────────────────────────────────────────
    // WEBHOOK SENDER (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processWebhookQueue() {
        jobQueue.claimOne("send_webhooks")
            .ifPresent(job -> {
                try {
                    Long instrumentId = job.getSubjectId();
                    List<String> tenantIds = job.getPayloadList("matching_tenants");
                    InstrumentWebhookPayload payload = buildWebhookPayload(instrumentId);
                    for (String tenantId : tenantIds) {
                        webhooks.deliver(tenantId, instrumentId, payload, "obligation.received");
                    }
                    jobQueue.markCompleted(job.getJobId());
                } catch (Exception e) {
                    jobQueue.markFailed(job.getJobId(), e.getMessage());
                }
            });
    }

    // ─────────────────────────────────────────────────────────────────
    // WEBHOOK RETRY (every 30 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 1_800_000)
    public void retryFailedWebhooks() {
        webhooks.retryFailed(10);
    }

    // ─────────────────────────────────────────────────────────────────
    // ANOMALY DETECTOR (every hour)
    // IMPROVEMENT #6
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 3_600_000)
    public void detectScraperAnomalies() {
        anomalyDetector.detectAnomalies();
    }
}
```

---

## HeadlessScraperStrategy.java — Full Playwright Implementation

Selenium is removed entirely. Playwright replaces it. Key differences:

| | Selenium (old) | Playwright (new) |
|---|---|---|
| Browser management | Requires ChromeDriver install + WebDriverManager | Bundles its own Chromium — zero setup |
| Waiting for content | `Thread.sleep(3000)` — fragile | `page.waitForSelector(...)` — deterministic |
| Docker stability | Crashes frequently in containers | Built for headless/Docker from day one |
| Download interception | Manual, complex | Native intercept API |
| PDF download handling | Awkward | `page.waitForDownload()` built-in |
| Memory | Heavy (one JVM-managed browser) | Lighter, better lifecycle control |

### One-Time Setup — Download Playwright Browsers

Playwright bundles Chromium but you must download it once on the server:

```bash
# Run once on server setup (or in your Dockerfile)
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI \
  -D exec.args="install chromium"
```

Or in your `Dockerfile`:

```dockerfile
FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY target/atheris-platform.jar app.jar

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Download Playwright's bundled Chromium
RUN java -jar app.jar install-playwright-browsers

ENTRYPOINT ["java", "-jar", "app.jar"]
```

### PlaywrightBrowserPool.java (Shared Browser Instance)

Creating a new browser per scrape is expensive. We keep one shared browser instance alive and create lightweight contexts per scrape.

```java
@Component
@Slf4j
public class PlaywrightBrowserPool {

    private Playwright playwright;
    private Browser browser;

    /**
     * Called once when the Spring context starts.
     * Launches one shared Chromium browser process.
     */
    @PostConstruct
    public void init() {
        log.info("Launching Playwright Chromium browser...");
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
            new BrowserType.LaunchOptions()
                .setHeadless(true)
                .setArgs(List.of(
                    "--no-sandbox",
                    "--disable-dev-shm-usage",    // Required in Docker
                    "--disable-gpu",
                    "--disable-extensions",
                    "--disable-background-networking",
                    "--disable-default-apps"
                ))
        );
        log.info("Playwright Chromium browser ready.");
    }

    /**
     * Called when Spring context shuts down.
     * Cleanly closes browser and Playwright.
     */
    @PreDestroy
    public void destroy() {
        log.info("Shutting down Playwright browser...");
        if (browser != null) browser.close();
        if (playwright != null) playwright.close();
    }

    /**
     * Create a fresh isolated browser context for one scrape session.
     * Each context has its own cookies, cache, and storage.
     * Lightweight — like an incognito window.
     */
    public BrowserContext newContext(Regulator regulator) {
        Browser.NewContextOptions options = new Browser.NewContextOptions()
            .setUserAgent("Atheris-HorizonScanner/1.0 (compliance@atheris.com)")
            .setIgnoreHTTPSErrors(true)   // Some gov sites have expired SSL certs
            .setViewportSize(1920, 1080);

        // Apply regulator-specific extra headers if configured
        if (regulator.getRequestHeaders() != null) {
            Map<String, String> headers = new HashMap<>();
            regulator.getRequestHeaders().fields()
                .forEachRemaining(e -> headers.put(e.getKey(), e.getValue().asText()));
            options.setExtraHTTPHeaders(headers);
        }

        return browser.newContext(options);
    }
}
```

### PlaywrightHeadlessStrategy.java (Full Implementation)

```java
@Component
@Slf4j
public class PlaywrightHeadlessStrategy {

    @Autowired private PlaywrightBrowserPool browserPool;

    /**
     * Uses a Playwright browser to render JS-heavy pages and extract PDF links.
     * Called for regulators with scraper_strategy = 'headless'.
     */
    public List<PdfLink> findPdfLinks(Regulator regulator, int startPage) {
        List<PdfLink> links = new ArrayList<>();

        int maxPages = regulator.getMaxPagesPerRun() != null
            ? regulator.getMaxPagesPerRun() : 3;

        // Create a fresh isolated context for this scrape session
        try (BrowserContext context = browserPool.newContext(regulator)) {

            Page page = context.newPage();

            // Block images, fonts, and media — we only need HTML and links
            // This makes page loads significantly faster
            page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,mp4,mp3}",
                route -> route.abort());

            String currentUrl = regulator.getPublicationPageUrl();
            int pageCount = 0;

            while (currentUrl != null && pageCount < maxPages) {
                log.info("Playwright scraping page {} of {} for {}: {}",
                    pageCount + 1, maxPages, regulator.getAbbreviation(), currentUrl);

                try {
                    // Navigate to the page
                    // waitUntil=NETWORKIDLE means: wait until no network requests
                    // for 500ms — page has fully loaded including JS
                    page.navigate(currentUrl,
                        new Page.NavigateOptions()
                            .setWaitUntil(WaitUntilState.NETWORKIDLE)
                            .setTimeout(30_000)
                    );

                    // If regulator has a specific selector, wait for it to appear
                    // This guarantees the content we care about has rendered
                    if (regulator.getPdfLinkSelector() != null
                            && !regulator.getPdfLinkSelector().isBlank()) {
                        page.waitForSelector(
                            regulator.getPdfLinkSelector(),
                            new Page.WaitForSelectorOptions().setTimeout(10_000)
                        );
                    }

                    // Extract PDF links from the rendered page
                    List<PdfLink> pageLinks = extractPdfLinks(page, regulator, currentUrl);
                    links.addAll(pageLinks);
                    log.info("Found {} PDF links on page {}", pageLinks.size(), pageCount + 1);

                    // Handle pagination
                    currentUrl = regulator.isPaginationEnabled()
                        ? findNextPageUrl(page, regulator, currentUrl)
                        : null;

                    pageCount++;

                    // Polite delay between pages — don't hammer the server
                    if (currentUrl != null) {
                        Thread.sleep(2_000);
                    }

                } catch (PlaywrightException e) {
                    log.error("Playwright error on page {}: {}", currentUrl, e.getMessage());

                    // If the page timed out or crashed, stop paginating
                    // Don't fail the entire scrape — return what we have so far
                    break;
                }
            }

            page.close();

        } catch (Exception e) {
            log.error("Playwright session failed for {}: {}",
                regulator.getAbbreviation(), e.getMessage());
        }

        return links;
    }

    /**
     * Extract all PDF links from the current page state.
     * Uses JSoup on the rendered HTML for consistent parsing.
     */
    private List<PdfLink> extractPdfLinks(Page page, Regulator regulator, String pageUrl) {
        List<PdfLink> links = new ArrayList<>();

        // Get the fully rendered HTML (after JS has run)
        String renderedHtml = page.content();

        // Parse with JSoup for convenient CSS selector support
        Document doc = Jsoup.parse(renderedHtml, pageUrl);

        // Use configured selector or default to finding all .pdf hrefs
        Elements pdfElements = findPdfElements(doc, regulator);

        for (Element el : pdfElements) {
            String href = el.absUrl("href");
            if (href.isEmpty()) continue;
            if (!isPdfUrl(href)) continue;

            String title = extractTitle(el, href);

            links.add(PdfLink.builder()
                .url(normaliseUrl(href))
                .title(title)
                .discoveredOnPage(pageUrl)
                .build()
            );
        }

        return links;
    }

    /**
     * Find the next page URL for pagination.
     * Three strategies based on regulator config.
     */
    private String findNextPageUrl(Page page, Regulator regulator, String currentUrl) {
        return switch (regulator.getPaginationStrategy()) {

            // Strategy 1: There is a "Next Page" button/link
            case "NEXT_BUTTON" -> {
                if (regulator.getPaginationSelector() == null) yield null;

                String renderedHtml = page.content();
                Document doc = Jsoup.parse(renderedHtml, currentUrl);
                Element nextLink = doc.selectFirst(regulator.getPaginationSelector());

                if (nextLink == null) yield null;

                String nextUrl = nextLink.absUrl("href");
                if (nextUrl.isEmpty() || nextUrl.equals(currentUrl)) yield null;

                yield nextUrl;
            }

            // Strategy 2: URL has a ?page=N parameter
            case "PAGE_PARAM" -> {
                URI uri = URI.create(currentUrl);
                String query = uri.getQuery();
                if (query == null) yield currentUrl + "?page=2";

                // Increment the page parameter
                String newQuery = query.replaceAll("page=\\d+",
                    "page=" + (extractPageNum(query) + 1));
                yield currentUrl.replace(query, newQuery);
            }

            // Strategy 3: URL has /year/ folders e.g. /2024/ /2023/
            case "YEAR_FOLDERS" -> {
                int currentYear = extractYearFromUrl(currentUrl);
                int startYear = regulator.getHistoricalStartYear() != null
                    ? regulator.getHistoricalStartYear() : 2022;

                if (currentYear <= startYear) yield null;

                yield currentUrl.replace(
                    "/" + currentYear + "/",
                    "/" + (currentYear - 1) + "/"
                );
            }

            default -> null;
        };
    }

    private Elements findPdfElements(Document doc, Regulator regulator) {
        if (regulator.getPdfLinkSelector() != null
                && !regulator.getPdfLinkSelector().isBlank()) {
            return doc.select(regulator.getPdfLinkSelector());
        }
        // Default: any anchor pointing to a PDF
        return doc.select("a[href]").stream()
            .filter(el -> isPdfUrl(el.absUrl("href")))
            .collect(Elements::new, Elements::add, Elements::addAll);
    }

    private boolean isPdfUrl(String url) {
        String lower = url.toLowerCase();
        return lower.endsWith(".pdf")
            || lower.contains(".pdf?")
            || lower.contains("/pdf/")
            || lower.contains("download=pdf")
            || lower.contains("type=pdf");
    }

    private String extractTitle(Element el, String href) {
        // Try link text first
        String text = el.text().trim();
        if (!text.isEmpty() && text.length() > 5) return text;

        // Try title attribute
        String title = el.attr("title").trim();
        if (!title.isEmpty()) return title;

        // Fall back to filename from URL
        String filename = href.substring(href.lastIndexOf('/') + 1);
        filename = filename.split("[?#]")[0]
            .replace(".pdf", "")
            .replace("-", " ")
            .replace("_", " ");
        return capitalise(filename);
    }

    private String normaliseUrl(String url) {
        return url.split("[?#]")[0].trim();
    }

    private int extractPageNum(String query) {
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("page=(\\d+)").matcher(query);
        return m.find() ? Integer.parseInt(m.group(1)) : 1;
    }

    private int extractYearFromUrl(String url) {
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("/(20\\d{2})/").matcher(url);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private String capitalise(String text) {
        if (text == null || text.isEmpty()) return text;
        return Character.toUpperCase(text.charAt(0)) + text.substring(1).toLowerCase();
    }
}
```

---

## REST API — Admin Backfill Endpoints (New)

```
POST   /api/v1/platform/regulators/{id}/backfill
       → Start a historical backfill for this regulator
       Body: { "start_year": 2022 }
       Response: { "backfill_id": 42, "status": "pending" }

GET    /api/v1/platform/regulators/{id}/backfill/{backfill_id}
       → Get backfill progress: current_page, docs_found, status

POST   /api/v1/platform/regulators/{id}/backfill/{backfill_id}/pause
       → Pause a running backfill

POST   /api/v1/platform/regulators/{id}/backfill/{backfill_id}/resume
       → Resume from where it left off (current_page preserved)

DELETE /api/v1/platform/regulators/{id}/backfill/{backfill_id}
       → Cancel backfill entirely
```

---

## PostgreSQL Full-Text Search (Improvement #8)

Once historical data exists, search becomes a core feature. PostgreSQL's built-in full-text search handles the MVP without additional infrastructure.

```sql
-- Add search vector column to instruments
ALTER TABLE instruments ADD COLUMN
  search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(source_title, '') || ' ' ||
      coalesce(area_of_focus, '') || ' ' ||
      coalesce(pdf_ocr_text, '')
    )
  ) STORED;

-- Index for fast full-text search
CREATE INDEX idx_instruments_search
  ON instruments USING GIN (search_vector);
```

```java
// API: search instruments
// GET /api/v1/platform/instruments?q=ATM+cash+24+hours&regulator=CBN

@GetMapping
public Page<InstrumentDto> search(
    @RequestParam(required = false) String q,
    @RequestParam(required = false) String regulator,
    @RequestParam(required = false) String theme,
    @RequestParam(required = false) String riskRating,
    Pageable pageable
) {
    return instrumentService.search(q, regulator, theme, riskRating, pageable);
}
```

```sql
-- Search query
SELECT *
FROM instruments
WHERE search_vector @@ plainto_tsquery('english', :query)
  AND (:regulator IS NULL OR regulator_id = :regulator)
  AND (:theme IS NULL OR theme_id = :theme)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC
LIMIT 20;
```

---

## Full Processing Flow (Updated)

```
Every 15 minutes — monitoring scraper
│
├── For each active regulator that is due:
│   │
│   ├── ScraperService.scrape(regulator, MONITORING)
│   │   │
│   │   ├── HtmlScraperStrategy or PlaywrightHeadlessStrategy
│   │   │   └── Returns List<PdfLink>
│   │   │
│   │   ├── For each new link:
│   │   │   │
│   │   │   ├── HEAD request → check Content-Type and Content-Length
│   │   │   │   [IMPROVEMENT #2 + #3]
│   │   │   │
│   │   │   ├── Snapshot source page HTML to S3
│   │   │   │   [IMPROVEMENT #5 — provenance]
│   │   │   │
│   │   │   ├── downloadWithRetry()
│   │   │   │   [IMPROVEMENT #4 — Resilience4j, 3 attempts, exponential backoff]
│   │   │   │   │
│   │   │   │   └── streamDownloadToS3()
│   │   │   │       HTTP InputStream
│   │   │   │         → DigestInputStream (SHA256 on the fly)
│   │   │   │           → S3 multipart upload in 8MB chunks
│   │   │   │       [IMPROVEMENT #1 — zero byte[] allocation]
│   │   │   │
│   │   │   ├── Read first 4 bytes from S3: verify %PDF magic bytes
│   │   │   │   [IMPROVEMENT #3 — double validation]
│   │   │   │
│   │   │   └── Enqueue job_queue: 'ocr_document' (priority=HIGH)
│   │   │
│   │   └── Log run to scraper_run_logs
│
2 minutes later — OCR processor
├── Claims HIGH priority 'ocr_document' job first
├── PDFBox extracts text (digital PDF)
│   or Tesseract (scanned image)
└── Enqueue: 'classify_instrument'
│
5 minutes later — Classifier
├── Claude API classifies instrument
├── Update instruments table
└── Enqueue: 'evaluate_applicability'
│
5 minutes later — Applicability
├── Match tenants by licence type
└── Enqueue: 'send_webhooks'
│
5 minutes later — Webhook sender
├── Sign + POST to each matched tenant
└── Log delivery
│
~17-22 minutes total: Ngozi sees it in her dashboard
│
Every hour — Anomaly detector
├── checkConsecutiveZeroRuns() — alert if 3 runs find 0 docs
└── checkDropInDocumentVolume() — alert if >90% drop in volume
│
On demand — Historical backfill (LOW priority)
└── Only runs when no HIGH priority jobs pending
    Paginated, resumable, isolated from monitoring pipeline
```

---

## Rollout Strategy

### Phase 1 (Now — MVP)
- Incremental monitoring only
- HTML strategy for static sites (SEC, NDIC, NAICOM)
- **Playwright** headless strategy for JS-rendered sites (CBN) — no Selenium
- All 4 must-do reliability improvements applied
- Manual upload fallback for edge cases

### Phase 2 (Short-term)
- Add provenance tracking (#5)
- Add anomaly detection (#6)
- Add PostgreSQL full-text search
- Add historical backfill for last 2-3 years per regulator

### Phase 3 (Long-term)
- Add semantic/vector search
- Add cross-regulator obligation comparison

---

## Folder Structure

```
modules/
└── scraper/
    ├── ScraperService.java               ← Main entry point (monitoring + backfill)
    ├── ScraperAnomalyDetector.java       ← IMPROVEMENT #6
    ├── strategy/
    │   ├── HtmlScraperStrategy.java      ← JSoup for static HTML
    │   └── PlaywrightHeadlessStrategy.java ← Playwright for JS-rendered sites
    ├── browser/
    │   └── PlaywrightBrowserPool.java    ← Shared browser instance (singleton)
    ├── backfill/
    │   ├── BackfillJob.java              ← Entity
    │   └── BackfillJobRepository.java
    ├── logs/
    │   ├── ScraperRunLog.java            ← Entity
    │   └── ScraperRunLogRepository.java
    └── dto/
        ├── PdfLink.java
        ├── ScraperRunResult.java
        └── ScrapeMode.java               ← Enum: MONITORING | BACKFILL
```


---

## 4 — Classification, Applicability & Webhooks

### 4.1 Cron-Based Job Pipeline


## Core Idea

Instead of:
```
horizon-service publishes event → Kafka topic → ai-classifier-service consumes
```

We do:
```
horizon-service inserts row → job_queue table → cron job polls table → ai-classifier-service processes
```

All state is in the database. All coordination is via cron jobs and database queries.

---

## Table 1: `job_queue` (The Job Queue)

The heart of the system. A simple table where services enqueue work.

```sql
CREATE TABLE job_queue (
  job_id BIGINT PRIMARY KEY,
  
  -- What is this job?
  job_type VARCHAR(100) NOT NULL,        -- 'ocr_document', 'classify_instrument', 
                                          -- 'evaluate_applicability', 'send_webhooks'
  
  -- What is it working on?
  subject_type VARCHAR(50),              -- 'instrument', 'obligation'
  subject_id BIGINT,                     -- FK to instruments table
  
  -- The work
  payload JSONB NOT NULL,                -- All data needed to process this job
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',  -- pending → processing → completed / failed
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,                  -- When did processing start?
  completed_at TIMESTAMP,                -- When did it finish?
  
  -- Retry logic
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,                       -- If job failed, what was the error?
  next_retry_at TIMESTAMP,               -- When to retry if failed?
  
  -- Ordering
  priority INT DEFAULT 0,                -- 0=normal, 1=high (for urgent regulations)
  created_by_service VARCHAR(100),       -- Which service created this job?
  
  -- Audit
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_status_priority (status, priority DESC, created_at),
  INDEX idx_next_retry (status, next_retry_at) WHERE status='failed',
  INDEX idx_subject (subject_type, subject_id)
);
```

**Example rows:**

```
job_id: 1001
job_type: 'ocr_document'
status: 'pending'
payload: {
  "regulator_id": 1,
  "pdf_url": "https://cbn.gov.ng/...",
  "title": "Re: Guidelines on ATM Cash Disbursement"
}
created_by_service: 'horizon-service'
created_at: 2026-05-31 02:14:22
```

---

## The Cron Jobs (The Workers)

Five cron jobs, each responsible for one stage of the pipeline. They run on a schedule and process jobs sequentially.

### Cron Job 1: Process OCR Documents

**Schedule:** Every 2 minutes

```bash
*/2 * * * * /app/bin/process-ocr-queue.py
```

**What it does:**
1. Find one pending 'ocr_document' job
2. Download PDF
3. OCR it
4. Create instrument record
5. Enqueue next job: 'classify_instrument'
6. Mark original job as completed

---

### Cron Job 2: Classify Instruments

**Schedule:** Every 5 minutes

```bash
*/5 * * * * /app/bin/process-classifier-queue.py
```

**What it does:**
1. Find one pending 'classify_instrument' job
2. Read instrument's OCR text
3. Call AI classifier
4. Update instrument with risk rating, area of focus, obligations
5. Create obligation_mappings rows
6. Enqueue next job: 'evaluate_applicability'
7. Mark original job as completed

---

### Cron Job 3: Evaluate Applicability

**Schedule:** Every 5 minutes

```bash
*/5 * * * * /app/bin/process-applicability-queue.py
```

**What it does:**
1. Find one pending 'evaluate_applicability' job
2. Build routing rule: "Which licence types get this obligation?"
3. Query matching tenants
4. Create tenant_eligibility_rules record
5. Enqueue next job: 'send_webhooks'
6. Mark original job as completed

---

### Cron Job 4: Send Webhooks

**Schedule:** Every 5 minutes

```bash
*/5 * * * * /app/bin/process-webhook-queue.py
```

**What it does:**
1. Find one pending 'send_webhooks' job
2. Build webhook payload (obligation + sanctions + specific duties)
3. For each matching tenant:
   - Sign payload with HMAC-SHA256
   - POST to tenant's webhook endpoint
   - Record delivery attempt in webhook_delivery_log
4. Mark original job as completed (even if some webhooks failed)

---

### Cron Job 5: Retry Failed Webhooks

**Schedule:** Every 30 minutes

```bash
*/30 * * * * /app/bin/retry-failed-webhooks.py
```

**What it does:**
1. Find webhooks that failed and are due for retry
2. Exponential backoff: 5min, 15min, 1hr, 4hr, 1day
3. For each, retry the POST request
4. If successful, mark as delivered
5. If still failing, schedule next retry

---

## Crontab Configuration

```bash
# /etc/cron.d/atheris

# Process OCR queue (every 2 minutes)
*/2 * * * * root /app/bin/process-ocr-queue.py >> /var/log/atheris/ocr.log 2>&1

# Process classifier queue (every 5 minutes)
*/5 * * * * root /app/bin/process-classifier-queue.py >> /var/log/atheris/classifier.log 2>&1

# Process applicability queue (every 5 minutes)
*/5 * * * * root /app/bin/process-applicability-queue.py >> /var/log/atheris/applicability.log 2>&1

# Send webhooks (every 5 minutes)
*/5 * * * * root /app/bin/process-webhook-queue.py >> /var/log/atheris/webhooks.log 2>&1

# Retry failed webhooks (every 30 minutes)
*/30 * * * * root /app/bin/retry-failed-webhooks.py >> /var/log/atheris/webhook-retries.log 2>&1

# Monitor job queue health (every hour)
0 * * * * root /app/bin/check-queue-health.py >> /var/log/atheris/health.log 2>&1
```

---

## Job Queue Monitoring

```python
# /app/bin/check-queue-health.py

def check_queue_health():
    cursor = DB_CONN.cursor()
    
    # Check for stuck jobs (processing > 1 hour)
    cursor.execute("""
        SELECT COUNT(*) as stuck_count
        FROM job_queue
        WHERE status='processing' 
          AND started_at < NOW() - INTERVAL '1 hour'
    """)
    
    stuck_count = cursor.fetchone()[0]
    if stuck_count > 0:
        send_alert(f"WARNING: {stuck_count} jobs stuck in processing")
    
    # Check pending queue depth
    cursor.execute("""
        SELECT job_type, COUNT(*) as count
        FROM job_queue
        WHERE status='pending'
        GROUP BY job_type
        ORDER BY count DESC
    """)
    
    print("Pending jobs by type:")
    for job_type, count in cursor.fetchall():
        print(f"  {job_type}: {count}")
    
    # Log metrics
    cursor.execute("""
        INSERT INTO queue_metrics (
          timestamp, pending_count, processing_count, completed_today, failed_count
        ) VALUES (
          NOW(),
          (SELECT COUNT(*) FROM job_queue WHERE status='pending'),
          (SELECT COUNT(*) FROM job_queue WHERE status='processing'),
          (SELECT COUNT(*) FROM job_queue WHERE status='completed' AND completed_at > NOW() - INTERVAL '1 day'),
          (SELECT COUNT(*) FROM job_queue WHERE status='failed')
        )
    """)
    
    DB_CONN.commit()

check_queue_health()
```

---

## Processing Timeline

```
2:14 AM   CBN publishes circular
          Scraper detects it (runs every 5 min)
          
2:16 AM   Cron: ocr-processor runs
          → OCR PDF, insert job_queue: 'classify_instrument'
          
2:21 AM   Cron: classifier runs
          → AI classifies, insert job_queue: 'evaluate_applicability'
          
2:26 AM   Cron: applicability runs
          → Build routing rule, insert job_queue: 'send_webhooks'
          
2:31 AM   Cron: webhook-sender runs
          → POST to GTB, Access, Zenith
          
2:31 AM   GTB receives webhook
          → Insert received_obligations
          → Create task for Ngozi
          
8:00 AM   Ngozi opens dashboard
          → Sees new obligation
```

**Total latency: ~5 hours.** Good enough for compliance.

---

## Processing Guarantees

1. **Sequential processing** — `FOR UPDATE SKIP LOCKED` ensures only one job processes at a time
2. **Idempotency** — Database constraints prevent duplicate results
3. **Ordering** — Jobs are processed in FIFO order (by created_at)
4. **Retryability** — Failed jobs stay in queue with exponential backoff
5. **Observability** — All state visible in job_queue and queue_metrics tables

---

## Cost Comparison

| Component | Kafka | Cron |
|-----------|-------|------|
| Message broker | ~$500-1000/mo | $0 |
| Monitoring tools | ~$200-500/mo | Built-in cron logs |
| Operational complexity | High | Low |
| **Total** | **$700-1500/mo** | **$0** |

---

## When to Upgrade to Kafka

Only if you hit these limits (years away):
- Regulations arriving >1000/day
- Tenants demanding <5min latency
- Handling >10,000 concurrent users
- Need sub-second ordering guarantees

For now: **Keep it simple. Cron is your friend.**


### 4.2 Webhook Delivery System


## Event Bus Architecture (Central Platform)

The central platform uses an event bus to coordinate between microservices. When something happens (scraper finds a new doc, AI classifies it, etc.), an event is published. Multiple services subscribe and react independently.

```
┌─────────────────────────────────────────────────────────────┐
│  Event Bus (Kafka or AWS EventBridge)                       │
├─────────────────────────────────────────────────────────────┤
│  Topic: regulatory.events                                   │
│  Partition by regulator_id (ensures ordering per regulator)│
└─────────────────────────────────────────────────────────────┘
                            ▲
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          │                 │                 │
      Scraper          AI Classifier      Webhook Router
    publishes          publishes          publishes
       events             events             events
```

---

## Platform-Level Events

These are events that happen inside the central platform. Other platform services consume them.

### Event 1: `horizon.document_detected`

**When:** horizon-service scraper finds a new PDF on a regulator website

**Published by:** horizon-service

**Consumed by:** ai-classifier-service

```json
{
  "event_type": "horizon.document_detected",
  "event_id": "evt_20260531_001",
  "timestamp": "2026-05-31T02:14:22Z",
  "regulator_id": 1,
  "regulator_name": "Central Bank of Nigeria",
  "document": {
    "title": "Re: Guidelines on ATM Cash Disbursement Operations",
    "publication_url": "https://cbn.gov.ng/Out/Circulars/2026/May/ATM-Guidelines-2026.pdf",
    "pdf_download_url": "https://cbn.gov.ng/Out/Circulars/2026/May/ATM-Guidelines-2026.pdf",
    "date_published": "2026-05-28",
    "page_count": 12
  },
  "source": "cbn_scraper",
  "confidence_score": 0.98
}
```

**Handler:** ai-classifier-service

```python
# Pseudocode
@on_event('horizon.document_detected')
async def handle_document_detected(event):
    # 1. Download PDF
    pdf_bytes = download_pdf(event.document.pdf_download_url)
    
    # 2. OCR the PDF
    ocr_text = ocr_service.extract_text(pdf_bytes)
    
    # 3. Store in instruments table as 'Triage'
    instrument_id = insert_instrument(
        regulator_id=event.regulator_id,
        title=event.document.title,
        pdf_ocr_text=ocr_text,
        status='Triage',
        discovered_at=event.timestamp
    )
    
    # 4. Publish the next event
    publish_event('instrument.discovered', {
        'instrument_id': instrument_id,
        'ocr_text': ocr_text
    })
```

---

### Event 2: `instrument.discovered`

**When:** A new instrument row is created in the database

**Published by:** ai-classifier-service (after OCR)

**Consumed by:** ai-classifier-service (itself), applicability-service

```json
{
  "event_type": "instrument.discovered",
  "event_id": "evt_20260531_002",
  "timestamp": "2026-05-31T02:30:15Z",
  "instrument_id": 4821,
  "regulator_id": 1,
  "title": "Re: Guidelines on ATM Cash Disbursement Operations",
  "pdf_ocr_text": "[Full 12-page text extracted by OCR]",
  "pdf_hash": "a3f1cc7e2b...",
  "status": "Triage"
}
```

**Handler:** ai-classifier-service

```python
# Pseudocode
@on_event('instrument.discovered')
async def classify_instrument(event):
    # Use the OCR text and AI to extract:
    # - area_of_focus
    # - licence_types_applicable
    # - risk_rating
    # - Specific obligations within the document
    
    classification = ai_classifier.classify(event.pdf_ocr_text)
    
    # Update the instrument record
    update_instrument(event.instrument_id, {
        'area_of_focus': classification.area_of_focus,
        'theme_id': classification.theme_id,
        'licence_types_applicable': classification.licence_types_applicable,
        'risk_rating': classification.risk_rating,
        'applicability_confidence': classification.confidence,
        'status': 'Classified'
    })
    
    # Create obligation_mappings rows (break circular into specific duties)
    for obligation in classification.obligations:
        create_obligation_mapping(
            instrument_id=event.instrument_id,
            plain_english_statement=obligation.statement,
            obligation_type=obligation.type
        )
    
    # Publish next event
    publish_event('instrument.classified', {
        'instrument_id': event.instrument_id,
        'classification': classification
    })
```

---

### Event 3: `instrument.classified`

**When:** AI classifier finishes enhancing the instrument with metadata

**Published by:** ai-classifier-service

**Consumed by:** applicability-service, sanctions-enricher-service, webhook-router-service

```json
{
  "event_type": "instrument.classified",
  "event_id": "evt_20260531_003",
  "timestamp": "2026-05-31T03:15:44Z",
  "instrument_id": 4821,
  "classification": {
    "area_of_focus": "Cash Management",
    "theme_id": 12,
    "nature": "Core",
    "risk_rating": "High",
    "licence_types_applicable": ["Commercial Bank", "Merchant Bank"],
    "entity_categories_applicable": null,
    "product_lines_applicable": ["ATM Operations"],
    "applicability_confidence": 0.97,
    "obligations": [
      {
        "statement": "All ATMs must be funded within 24 hours of cash depletion",
        "section_reference": "Section 4.1",
        "type": "Operational",
        "recurring_deadline_type": "Continuous"
      },
      {
        "statement": "Banks must report ATM downtime exceeding 48 hours to CBN",
        "section_reference": "Section 5.2",
        "type": "Reporting",
        "recurring_deadline_type": "As needed"
      }
    ]
  }
}
```

**Handler:** sanctions-enricher-service

```python
# Pseudocode
@on_event('instrument.classified')
async def enrich_with_sanctions(event):
    # Look up the penalties/sanctions for this instrument
    # From regulatory databases or knowledge bases
    
    sanctions = lookup_sanctions(
        regulator_id=event.instrument_id,  # (would fetch from instrument)
        instrument_title=event.classification.title
    )
    
    # Insert into sanctions_and_penalties table
    for sanction in sanctions:
        create_sanction_record(
            instrument_id=event.instrument_id,
            sanction_type=sanction.type,
            amount=sanction.amount,
            liable_roles=sanction.liable_roles
        )
    
    # Publish next event (this service doesn't block the flow)
```

**Handler:** applicability-service

```python
# Pseudocode
@on_event('instrument.classified')
async def evaluate_applicability(event):
    # Build a routing rule: which tenants should get this?
    
    rule = build_routing_rule(
        licence_types=event.classification.licence_types_applicable,
        product_lines=event.classification.product_lines_applicable,
        confidence=event.classification.applicability_confidence
    )
    
    # Pre-compute which tenants match
    matching_tenants = query_tenants(rule_condition=rule.sql_condition)
    
    # Create tenant_eligibility_rules record
    create_eligibility_rule(
        instrument_id=event.instrument_id,
        rule_condition=rule.sql_condition,
        target_tenant_count=len(matching_tenants),
        should_route=True,
        route_with_confidence_level='High' if rule.confidence > 0.9 else 'Medium'
    )
    
    # Publish next event (webhook router consumes this)
    publish_event('instrument.ready_to_route', {
        'instrument_id': event.instrument_id,
        'matching_tenants': matching_tenants,
        'applicability_rule': rule
    })
```

---

### Event 4: `instrument.ready_to_route`

**When:** All enrichment and applicability evaluation is complete

**Published by:** applicability-service

**Consumed by:** webhook-router-service

```json
{
  "event_type": "instrument.ready_to_route",
  "event_id": "evt_20260531_004",
  "timestamp": "2026-05-31T03:45:22Z",
  "instrument_id": 4821,
  "matching_tenants": [
    {
      "tenant_id": "uuid-gtb",
      "legal_name": "Guaranty Trust Bank",
      "licence_type": "Commercial Bank",
      "webhook_url": "https://compliance.gtb.com/v1/webhooks/atheris"
    },
    {
      "tenant_id": "uuid-access",
      "legal_name": "Access Bank",
      "licence_type": "Commercial Bank",
      "webhook_url": "https://api.accessbank.com/webhooks/compliance"
    },
    {
      "tenant_id": "uuid-zenith",
      "legal_name": "Zenith Bank",
      "licence_type": "Commercial Bank",
      "webhook_url": "https://zenith-api.com/regulatory/webhooks"
    }
  ],
  "applicability_rule": {
    "condition": "licence_type IN ('Commercial Bank', 'Merchant Bank')",
    "confidence": 0.97
  }
}
```

---

## Webhook Delivery (Platform to Tenants)

### Webhook Type 1: `obligation.received`

**What:** "A new obligation has been published. You should review it."

**Who sends it:** webhook-router-service (on the central platform)

**Who receives it:** Each matched tenant's webhook endpoint

**When:** Immediately after `instrument.ready_to_route` event

**HTTP Details:**
```
POST https://compliance.gtb.com/v1/webhooks/atheris
Authorization: Bearer {webhook_signing_key}
X-Atheris-Signature: sha256={HMAC_SHA256(body, webhook_secret)}
X-Webhook-Event-ID: evt_20260531_004
X-Webhook-Timestamp: 2026-05-31T03:45:22Z
Content-Type: application/json

{
  "webhook_type": "obligation.received",
  "webhook_id": "webhook_20260531_001",
  "timestamp": "2026-05-31T03:45:22Z",
  
  "obligation": {
    "obligation_id": 4821,
    "platform_obligation_id": 4821,
    "source_title": "Re: Guidelines on ATM Cash Disbursement Operations",
    "regulator": "Central Bank of Nigeria",
    "regulator_abbreviation": "CBN",
    "instrument_type": "Circular",
    "type_id": 3,
    "area_of_focus": "Cash Management",
    "theme": "Cash Management",
    "theme_id": 12,
    "nature": "Core",
    "risk_rating": "High",
    "date_issued": "2026-05-28",
    "date_commencement": "2026-07-01",
    "compliance_deadline_days": 31,
    
    "specific_obligations": [
      {
        "obligation_number": 1,
        "statement": "All ATMs must be funded within 24 hours of cash depletion",
        "section_reference": "Section 4.1",
        "type": "Operational"
      },
      {
        "obligation_number": 2,
        "statement": "Banks must report ATM downtime exceeding 48 hours to CBN",
        "section_reference": "Section 5.2",
        "type": "Reporting"
      }
    ],
    
    "sanctions": [
      {
        "sanction_type": "Fine per branch",
        "amount_naira": 1000000,
        "liable_roles": ["MD", "Head Operations", "CCO"],
        "severity": "High",
        "enforced_recently": true
      }
    ],
    
    "applicability_confidence": 0.97,
    "applicability_notes": "Applies to all commercial banks with ATM operations"
  }
}
```

**Tenant-side handler:**

```python
# Pseudocode - GTB's webhook receiver
@app.post('/v1/webhooks/atheris')
async def receive_obligation_webhook(request: Request):
    # 1. Verify signature
    signature = request.headers.get('X-Atheris-Signature')
    body = await request.body()
    
    if not verify_hmac_sha256(body, signature, GTB_WEBHOOK_SECRET):
        return {'error': 'Invalid signature'}, 401
    
    webhook_payload = json.loads(body)
    
    # 2. Insert into received_obligations table
    obligation = webhook_payload['obligation']
    
    db.received_obligations.insert({
        'obligation_id': obligation['obligation_id'],
        'platform_obligation_id': obligation['platform_obligation_id'],
        'source_title': obligation['source_title'],
        'regulator': obligation['regulator'],
        'area_of_focus': obligation['area_of_focus'],
        'platform_risk_rating': obligation['risk_rating'],
        'is_applicable': None,  # Tenant hasn't decided yet
        'status': 'Received',
        'platform_received_at': datetime.now(),
        'linked_control_ids': [],  # Will be filled in by GTB's compliance team
    })
    
    # 3. Create a task for Ngozi to classify it
    create_task(
        task_type='Classify Obligation',
        assigned_to='ngozi.eze@gtb.com',
        subject=f"Review new obligation: {obligation['source_title']}",
        priority='High' if obligation['risk_rating'] == 'High' else 'Normal',
        due_date=date.today() + timedelta(days=5),
        reference_obligation_id=obligation['obligation_id']
    )
    
    # 4. Send email notification
    send_email(
        to='ngozi.eze@gtb.com',
        subject=f"New regulatory obligation: {obligation['source_title']}",
        body=f"""
A new CBN circular has been detected and classified.

Title: {obligation['source_title']}
Area: {obligation['area_of_focus']}
Risk Rating: {obligation['risk_rating']}
Deadline: {obligation['date_commencement']} + {obligation['compliance_deadline_days']} days

Please review and classify this obligation in Atheris.
{ATHERIS_DASHBOARD_URL}
"""
    )
    
    # 5. Log audit event
    create_audit_event(
        actor='system',
        action='obligation_received_via_webhook',
        subject_type='obligation',
        subject_id=obligation['obligation_id'],
        after_json=obligation
    )
    
    # 6. Return 200 OK (acknowledge receipt)
    return {'status': 'received', 'webhook_id': webhook_payload['webhook_id']}
```

**Retry logic:**

```
If webhook delivery fails:
  Retry 1: After 5 minutes
  Retry 2: After 15 minutes
  Retry 3: After 1 hour
  Retry 4: After 4 hours
  Retry 5: After 1 day
  
  If all retries fail: Alert platform team, mark webhook as failed
  
The central platform maintains a webhook_delivery_log table:
  - webhook_id, tenant_id, status (pending/delivered/failed)
  - last_attempt_at, attempt_count
  - response_status_code, response_body (for debugging)
```

---

### Webhook Type 2: `obligation.applicability_updated`

**What:** "An obligation's applicability rules have changed. You might want to re-evaluate your decision."

**Trigger:** When the central platform re-evaluates an obligation (e.g., ISA 2025 implementation rules finally arrive)

**Example scenario:**

```
June 1: ISA 2025 publishes in DRAFT status with applicability UNCERTAIN
        Webhook sent to all tenants: "Review this — applicability TBD"
        
Aug 15: SEC clarifies: ISA 2025 applies only to Capital Market Dealers
        Central platform updates instrument status to PUBLISHED
        applicability_confidence changes from 0.40 to 0.92
        licence_types_applicable changes from NULL to ['Capital Market Dealer']
        
Webhook Type 2 sent to all tenants:
```

```json
{
  "webhook_type": "obligation.applicability_updated",
  "webhook_id": "webhook_20260815_042",
  "timestamp": "2026-08-15T08:30:00Z",
  "obligation_id": 5102,
  
  "changes": {
    "status": {
      "old_value": "Draft",
      "new_value": "Published",
      "reason": "SEC clarified implementation rules on 2026-08-15"
    },
    "applicability_confidence": {
      "old_value": 0.40,
      "new_value": 0.92
    },
    "licence_types_applicable": {
      "old_value": null,
      "new_value": ["Capital Market Dealer", "Investment Adviser"]
    }
  },
  
  "action_required": true,
  "action_description": "You previously marked this obligation as 'Not yet decided'. Applicability is now clarified. Please review and update your decision."
}
```

**Tenant-side handler:**

```python
# Pseudocode
@app.post('/v1/webhooks/atheris')
async def receive_applicability_update(request: Request):
    webhook = json.loads(await request.body())
    obligation_id = webhook['obligation_id']
    
    # Create a notification for the CCO
    create_notification(
        recipient='cco@gtb.com',
        type='obligation_applicability_changed',
        subject=f"Update: Obligation {obligation_id} applicability clarified",
        body=f"The platform has updated applicability for an obligation you reviewed. Previous decision: 'Not yet decided'. New info: applies to {', '.join(webhook['changes']['licence_types_applicable']['new_value'])}",
        action_url=f"{ATHERIS_DASHBOARD_URL}/obligations/{obligation_id}"
    )
    
    # Audit log
    create_audit_event(
        actor='system',
        action='obligation_applicability_updated',
        subject_type='obligation',
        subject_id=obligation_id,
        before_json={'confidence': webhook['changes']['applicability_confidence']['old_value']},
        after_json={'confidence': webhook['changes']['applicability_confidence']['new_value']},
        reason=webhook['changes']['status']['reason']
    )
    
    return {'status': 'processed'}
```

---

### Webhook Type 3: `obligation.superseded`

**What:** "An obligation you were tracking has been repealed. You can retire the controls."

**Trigger:** When a circular is withdrawn or superseded

**Example:**

```json
{
  "webhook_type": "obligation.superseded",
  "webhook_id": "webhook_20260920_107",
  "timestamp": "2026-09-20T11:15:00Z",
  "obligation_id": 3847,
  "superseded_by_obligation_id": 4821,
  "reason": "Circular CBN/2024/Old was withdrawn. New guidelines issued in CBN/2026/New",
  "action_required": false,
  "action_description": "You can retire CTRL-044 if it was linked only to this obligation. Or keep it running if other obligations still require it."
}
```

---

## Webhook Delivery Guarantee

The central platform **guarantees at-least-once delivery**:

1. **Idempotent webhooks** — If GTB receives the same obligation twice, the second insert fails silently (primary key conflict). No duplicates.

2. **Ordering guarantee** — Webhooks for the same obligation are delivered in order. You won't get "superseded" before "received".

3. **Signed webhooks** — Every webhook is HMAC-SHA256 signed. Tenants verify before processing.

4. **Audit trail on both sides:**
   - **Central:** webhook_delivery_log tracks every send attempt
   - **Tenant:** audit_events logs every received webhook

---

## Webhook Delivery Flow (Detailed)

```
Central Platform (Time: 3:45 AM on May 31)
├─ instrument.classified event published to Kafka
│
├─ applicability-service consumes event
│  └─ Computes: Commercial Banks should get this
│     Publishes: instrument.ready_to_route
│
├─ webhook-router-service consumes instrument.ready_to_route
│  ├─ Query matching tenants: GTB, Access, Zenith
│  │
│  ├─ For each tenant:
│  │  ├─ Build obligation payload
│  │  ├─ Sign with HMAC-SHA256
│  │  ├─ POST to tenant's webhook endpoint
│  │  ├─ Insert webhook_delivery_log row: status = 'pending'
│  │  │
│  │  └─ If 200 OK:
│  │     └─ Update webhook_delivery_log: status = 'delivered', delivered_at = NOW()
│  │
│  │  └─ If timeout/error:
│  │     ├─ Enqueue retry
│  │     └─ Publish 'webhook.delivery_failed' event (for monitoring/alerting)
│  │
│  └─ Publish: instrument.routed (metrics: "delivered to 3 tenants")
│
└─ Monitoring service consumes instrument.routed
   └─ Log success metrics to dashboard

Tenant Side (GTB, Time: 3:45 AM)
├─ GTB's webhook receiver gets POST request
├─ Verify HMAC-SHA256 signature
├─ Insert into received_obligations
├─ Create task for Ngozi
├─ Send email notification
├─ Log audit_event
└─ Return 200 OK

(All within 500ms)
```

---

## Tenant Reporting Back to Platform (Optional)

Tenants can optionally push data back to the platform via a reverse webhook or API. This is for platform analytics (not required for compliance):

```python
# Optional: GTB can tell the platform about its own compliance status
POST https://platform.atheris.com/v1/tenants/uuid-gtb/compliance-snapshot
Authorization: Bearer {tenant_api_key}
Content-Type: application/json

{
  "snapshot_date": "2026-06-30",
  "total_obligations_active": 350,
  "obligations_high_risk": 47,
  "control_tests_passed": 145,
  "control_tests_failed": 5,
  "findings_open": 3,
  "returns_submitted_on_time": 100,
  "compliance_score": 84
}
```

The platform can use this to:
- Aggregate industry benchmarks ("avg compliance score across all banks: 82%")
- Identify at-risk tenants ("GTB's score dropped 10 points this quarter")
- SaaS metrics (usage, engagement)

But this is **not required** for the core compliance functionality.

---

## Event Ordering Guarantees

The event bus uses Kafka with partitioning to ensure:

1. **All events for a single obligation go to the same partition** (keyed by `obligation_id`)
2. **Consumers process them in order** (no parallel processing of the same obligation)
3. **Idempotency** ensures that even if a service crashes and replays, results are correct

```
Kafka Partitioning:
  Topic: regulatory.events
  Partitions: 43 (one per regulator)
  
  Events for CBN instruments → Partition 0 (ordered)
  Events for SEC instruments → Partition 1 (ordered)
  ...
  
  This ensures all CBN circulars are processed sequentially
  (No race conditions on instrument updates)
```

---

## Monitoring and Alerting

The platform monitors webhook delivery health:

```sql
-- Webhook delivery metrics (run daily)
SELECT 
  COUNT(*) as total_webhooks_sent,
  COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status='failed' THEN 1 END) as failed,
  AVG(delivery_latency_ms) as avg_latency,
  MAX(delivery_latency_ms) as max_latency
FROM webhook_delivery_log
WHERE sent_at >= NOW() - INTERVAL 24 hours;

-- Alert if:
--   failed count > 5
--   delivery_success_rate < 99%
--   avg_latency > 5000ms
```

---

## Key Design Principles

1. **Webhooks are push, not pull** — Tenants don't need to continuously query. The platform pushes updates.

2. **Events are immutable** — Once published, an event never changes. Corrections come as new events.

3. **Idempotent receivers** — Webhooks can be delivered more than once. Tenants handle this gracefully (primary key constraints).

4. **Signed webhooks** — Every webhook is HMAC-signed so tenants verify authenticity.

5. **No blocking dependencies** — If a tenant's webhook endpoint is down, the platform retries but doesn't wait. Other tenants still get their webhooks.

6. **Full audit trail** — Both central and tenant sides log every event. Examiners can trace "when did GTB receive obligation X?" and "how did they classify it?"

7. **At-least-once delivery** — The platform guarantees the obligation reaches the tenant. It may arrive twice, but never zero times (unless the tenant permanently unreachable, then platform alerts).

---

## Webhook Schema Reference

All webhooks follow this envelope:

```json
{
  "webhook_type": "obligation.received | obligation.updated | obligation.superseded",
  "webhook_id": "webhook_YYYYMMDD_NNN",
  "timestamp": "ISO-8601",
  "X-Atheris-Signature": "sha256=...",
  
  // The payload (varies by webhook_type)
  "obligation": { ... },
  "changes": { ... },
  etc.
}
```

**Tenant-side validation checklist:**

```
✓ Verify X-Atheris-Signature HMAC-SHA256
✓ Check webhook_id is not a duplicate (idempotency key)
✓ Verify timestamp is recent (< 5 minutes old) — prevents replay attacks
✓ Parse webhook_type and route to correct handler
✓ Log in audit_events before processing
✓ Return 200 OK only after successfully inserting into database
```

---

## Summary: Data Flow from Start to Finish

```
1. CBN publishes new circular (May 31, 2:14 AM)
   ↓
2. Scraper detects it (horizon.document_detected)
   ↓
3. AI classifies it (instrument.classified)
   ↓
4. Applicability rules computed (instrument.ready_to_route)
   ↓
5. Webhook sent to matching tenants (May 31, 3:45 AM)
   ↓
6. GTB receives webhook, inserts into received_obligations
   ↓
7. Ngozi sees task in her dashboard (May 31, 8:00 AM)
   ↓
8. Ngozi classifies: assigns owner, links controls, marks applicable
   ↓
9. Emeka (control owner) sees task to test CTRL-044
   ↓
10. Emeka runs test monthly (June 13), uploads evidence
    ↓
11. Test result recorded, finding auto-opened if failed
    ↓
12. CCO reviews and approves
    ↓
13. Evidence sealed in audit_events table (immutable)
    ↓
14. Dashboard snapshot computed nightly
    ↓
15. Board sees compliance health in morning report (100% automated)
```

All done within the regulatory deadline of June 1 (date of commencement = July 1, 31 days to comply).


---

## 5 — Service Design & REST APIs


## System Overview

Atheris is a multi-tenant regulatory compliance platform with two distinct deployment environments:

1. **Central Platform** — Owned by Atheris. Handles regulatory intelligence, scraping, OCR, AI classification, applicability routing, and tenant management.
2. **Tenant Environment** — One per institution (bank, fintech, pension fund). Handles obligation classification, control management, testing, findings, returns, and evidence.

Both environments are Spring Boot applications. The central platform is a monolith (for simplicity). Each tenant environment is a lighter Spring Boot app.

---

## Tech Stack

```
Backend      : Spring Boot 3.x (Java 21)
Database     : PostgreSQL 16
PDF          : Apache PDFBox 3.x (digital PDFs)
OCR fallback : Tesseract + Tess4J (scanned PDFs)
AI           : Anthropic Claude API (classification)
File storage : AWS S3 (or MinIO for self-hosted)
Auth         : Spring Security + JWT
Scheduler    : Spring @Scheduled (replaces Kafka)
Email        : Spring Mail (SMTP)
```

---

## Central Platform — Service Map

```
atheris-platform/
├── src/main/java/com/atheris/platform/
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── SchedulingConfig.java
│   │   └── S3Config.java
│   │
│   ├── modules/
│   │   ├── regulators/          ← Manage regulators + scraper config
│   │   ├── instruments/         ← The master regulatory library
│   │   ├── obligations/         ← Obligation mappings per instrument
│   │   ├── sanctions/           ← Penalties and consequences KB
│   │   ├── classification/      ← AI classification pipeline
│   │   ├── applicability/       ← Tenant routing logic
│   │   ├── tenants/             ← Tenant registry and management
│   │   ├── webhooks/            ← Webhook delivery to tenants
│   │   └── jobs/                ← Job queue and cron processors
│   │
│   └── shared/
│       ├── ocr/                 ← PDFBox + Tesseract service
│       ├── storage/             ← S3 upload/download
│       ├── ai/                  ← Claude API wrapper
│       └── audit/               ← Platform audit log
```

---

## Module 1: Regulators

Regulators are fully configurable from the UI. Platform admins can add regulators, update their scraper URL, enable/disable scraping, and configure scan frequency.

### Data Model

```sql
CREATE TABLE regulators (
  regulator_id    SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,           -- "Central Bank of Nigeria"
  abbreviation    VARCHAR(20)  NOT NULL UNIQUE,    -- "CBN"
  country         VARCHAR(100) DEFAULT 'Nigeria',
  website_url     TEXT,                            -- "https://cbn.gov.ng"
  
  -- Scraper config (editable from UI)
  scraper_enabled     BOOLEAN DEFAULT true,
  publication_page_url TEXT,                       -- Where circulars are listed
  scraper_frequency   VARCHAR(50) DEFAULT 'daily', -- daily / hourly / weekly
  scraper_selector    TEXT,                        -- CSS selector for PDF links (optional)
  scraper_last_ran_at TIMESTAMP,
  scraper_last_found  INT DEFAULT 0,               -- How many docs found last run?
  
  -- Metadata
  logo_url       TEXT,
  description    TEXT,
  created_by     INT,                              -- Admin user who added it
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  is_active      BOOLEAN DEFAULT true
);
```

### REST API — Regulators

```
-- Admin endpoints (require PLATFORM_ADMIN role)

GET    /api/v1/platform/regulators
       → List all regulators with scraper status

POST   /api/v1/platform/regulators
       → Add a new regulator
       Body: {
         "name": "Federal Competition and Consumer Protection Commission",
         "abbreviation": "FCCPC",
         "website_url": "https://fccpc.gov.ng",
         "publication_page_url": "https://fccpc.gov.ng/publications",
         "scraper_enabled": true,
         "scraper_frequency": "daily"
       }

GET    /api/v1/platform/regulators/{id}
       → Get one regulator with full config

PUT    /api/v1/platform/regulators/{id}
       → Update regulator (name, URL, scraper config, enable/disable)
       Body: {
         "publication_page_url": "https://cbn.gov.ng/Out/Circulars",
         "scraper_enabled": true,
         "scraper_frequency": "hourly"
       }

DELETE /api/v1/platform/regulators/{id}
       → Soft delete (set is_active=false)

POST   /api/v1/platform/regulators/{id}/test-scraper
       → Trigger a one-off scrape of this regulator NOW
       → Returns: { "found_documents": 3, "new_documents": 1, "sample": [...] }

GET    /api/v1/platform/regulators/{id}/scraper-history
       → Last 30 scraper runs: how many docs found, errors, timing
```

### RegulatorController.java

```java
@RestController
@RequestMapping("/api/v1/platform/regulators")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class RegulatorController {

    @Autowired private RegulatorService regulatorService;
    @Autowired private ScraperService scraperService;

    @GetMapping
    public ResponseEntity<List<RegulatorDto>> listRegulators(
        @RequestParam(required = false) Boolean activeOnly
    ) {
        return ResponseEntity.ok(regulatorService.findAll(activeOnly));
    }

    @PostMapping
    public ResponseEntity<RegulatorDto> createRegulator(
        @Valid @RequestBody CreateRegulatorRequest req,
        @AuthenticationPrincipal PlatformUser user
    ) {
        RegulatorDto created = regulatorService.create(req, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegulatorDto> updateRegulator(
        @PathVariable Long id,
        @Valid @RequestBody UpdateRegulatorRequest req
    ) {
        return ResponseEntity.ok(regulatorService.update(id, req));
    }

    @PostMapping("/{id}/test-scraper")
    public ResponseEntity<ScraperTestResult> testScraper(@PathVariable Long id) {
        // Runs a one-off scrape immediately — for admin testing
        ScraperTestResult result = scraperService.testScraper(id);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/scraper-history")
    public ResponseEntity<List<ScraperRunLog>> scraperHistory(@PathVariable Long id) {
        return ResponseEntity.ok(scraperService.getHistory(id, 30));
    }
}
```

---

## Module 2: Instruments (Regulatory Library)

### Data Model (same as Central Intelligence Schema)

Key additions for the admin upload endpoint:

```sql
ALTER TABLE instruments ADD COLUMN
  upload_source VARCHAR(50) DEFAULT 'scraper';  -- 'scraper' | 'manual_upload' | 'api'

ALTER TABLE instruments ADD COLUMN
  uploaded_by INT;  -- If manual upload, which admin?
```

### REST API — Instruments

```
-- Admin endpoints

GET    /api/v1/platform/instruments
       → List all instruments (paginated)
       Filters: ?regulator_id=1&status=Triage&theme=AML&risk_rating=High

GET    /api/v1/platform/instruments/{id}
       → Get full instrument including obligations and sanctions

POST   /api/v1/platform/instruments/upload
       → MANUAL UPLOAD: Admin uploads a PDF directly
       Content-Type: multipart/form-data
       Body: {
         "file": <PDF binary>,
         "regulator_id": 1,
         "title": "CBN Circular on ATM Operations 2026",  -- optional, extracted if blank
         "date_issued": "2026-05-28",                     -- optional
         "force_ocr": false                               -- force Tesseract even if PDFBox works
       }
       Response: {
         "instrument_id": 4821,
         "status": "Triage",
         "extracted_text_preview": "First 500 chars...",
         "job_id": 1001,
         "message": "Document uploaded. Classification queued."
       }

POST   /api/v1/platform/instruments/{id}/classify-now
       → Force immediate re-classification of an existing instrument
       → Skips the cron queue, runs synchronously
       → Useful when admin wants to verify AI classification

PUT    /api/v1/platform/instruments/{id}
       → Update instrument metadata (correct AI classification)
       Body: {
         "area_of_focus": "Cash Management",
         "risk_rating": "High",
         "nature": "Core",
         "licence_types_applicable": ["Commercial Bank"]
       }

POST   /api/v1/platform/instruments/{id}/publish
       → Manually approve instrument for routing to tenants
       → Changes status from Triage → Published

DELETE /api/v1/platform/instruments/{id}
       → Soft delete (set status='Withdrawn')
```

### DocumentUploadController.java

```java
@RestController
@RequestMapping("/api/v1/platform/instruments")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class DocumentUploadController {

    @Autowired private InstrumentService instrumentService;
    @Autowired private PdfExtractionService pdfExtractor;
    @Autowired private StorageService storageService;
    @Autowired private JobQueueService jobQueue;
    @Autowired private AuditService auditService;

    /**
     * Admin manually uploads a PDF document.
     * Handles both digital PDFs (PDFBox) and scanned images (Tesseract).
     */
    @PostMapping("/upload")
    public ResponseEntity<UploadResponse> uploadDocument(
        @RequestParam("file") MultipartFile file,
        @RequestParam("regulator_id") Long regulatorId,
        @RequestParam(value = "title", required = false) String title,
        @RequestParam(value = "date_issued", required = false) String dateIssued,
        @RequestParam(value = "force_ocr", defaultValue = "false") boolean forceOcr,
        @AuthenticationPrincipal PlatformUser admin
    ) {
        // 1. Validate file
        if (file.isEmpty()) throw new BadRequestException("File is empty");
        if (!file.getContentType().equals("application/pdf"))
            throw new BadRequestException("Only PDF files are accepted");
        if (file.getSize() > 50 * 1024 * 1024)  // 50MB limit
            throw new BadRequestException("File size exceeds 50MB limit");

        try {
            byte[] pdfBytes = file.getBytes();
            String pdfHash = sha256Hex(pdfBytes);

            // 2. Check for duplicate
            Optional<Instrument> existing = instrumentService.findByHash(pdfHash);
            if (existing.isPresent()) {
                return ResponseEntity.ok(UploadResponse.duplicate(existing.get()));
            }

            // 3. Extract text (PDFBox first, Tesseract fallback)
            String extractedText = forceOcr
                ? pdfExtractor.extractWithTesseract(pdfBytes)
                : pdfExtractor.extractText(pdfBytes);

            // 4. Upload PDF to S3
            String s3Key = "instruments/" + pdfHash + ".pdf";
            String s3Url = storageService.upload(pdfBytes, s3Key, "application/pdf");

            // 5. Create instrument record in Triage status
            Instrument instrument = Instrument.builder()
                .regulatorId(regulatorId)
                .sourceTitle(title != null ? title : extractTitleFromText(extractedText))
                .pdfOcrText(extractedText)
                .pdfUrl(s3Url)
                .pdfHash(pdfHash)
                .dateIssued(dateIssued != null ? LocalDate.parse(dateIssued) : null)
                .status("Triage")
                .uploadSource("manual_upload")
                .uploadedBy(admin.getId())
                .discoveredAt(Instant.now())
                .build();

            instrumentService.save(instrument);

            // 6. Enqueue classification job
            Long jobId = jobQueue.enqueue(JobType.CLASSIFY_INSTRUMENT,
                instrument.getInstrumentId(),
                Map.of("instrument_id", instrument.getInstrumentId(),
                       "pdf_ocr_text", extractedText)
            );

            // 7. Audit log
            auditService.log(admin.getId(), "manual_upload", "instrument",
                instrument.getInstrumentId(),
                Map.of("file_name", file.getOriginalFilename(),
                       "regulator_id", regulatorId,
                       "text_length", extractedText.length())
            );

            // 8. Response
            return ResponseEntity.status(HttpStatus.CREATED).body(
                UploadResponse.builder()
                    .instrumentId(instrument.getInstrumentId())
                    .status("Triage")
                    .extractedTextPreview(extractedText.substring(0, Math.min(500, extractedText.length())))
                    .textLength(extractedText.length())
                    .jobId(jobId)
                    .message("Document uploaded and queued for AI classification. Check back in 5-10 minutes.")
                    .build()
            );

        } catch (IOException e) {
            throw new InternalServerException("Failed to process PDF: " + e.getMessage());
        }
    }

    /**
     * Force immediate re-classification.
     * Runs synchronously — blocks until AI responds.
     * Use for admin review and correction.
     */
    @PostMapping("/{id}/classify-now")
    public ResponseEntity<ClassificationResult> classifyNow(@PathVariable Long id) {
        Instrument instrument = instrumentService.findById(id)
            .orElseThrow(() -> new NotFoundException("Instrument not found"));

        ClassificationResult result = classificationService.classifySync(
            instrument.getInstrumentId(),
            instrument.getPdfOcrText()
        );

        return ResponseEntity.ok(result);
    }
}
```

---

## Module 3: Classification (AI Pipeline)

Uses Claude API to classify each instrument.

### ClassificationService.java

```java
@Service
public class ClassificationService {

    @Autowired private AnthropicClient claudeClient;
    @Autowired private InstrumentRepository instruments;
    @Autowired private ObligationMappingRepository obligations;
    @Autowired private JobQueueService jobQueue;

    private static final String CLASSIFICATION_PROMPT = """
        You are a Nigerian financial regulatory compliance expert.
        
        A new regulatory document has been detected. Analyse the text and extract:
        
        1. area_of_focus: Which compliance domain? Choose from:
           [AML/CFT, Corporate Governance, Cash Management, Data Protection,
            Consumer Protection, Cybersecurity, ABAC, ESG, Capital Market,
            Account Management, Financial Reporting, Conduct Risk]
        
        2. nature: Core / Secondary / Guidance
           - Core = legally binding, penalties for non-compliance
           - Secondary = required but lower penalty
           - Guidance = best practice, no penalty
        
        3. risk_rating: High / Medium / Low
           - High = fine > ₦5m OR licence suspension risk
           - Medium = fine ₦500k-5m
           - Low = warning only or no fine specified
        
        4. licence_types_applicable: Array. Choose all that apply:
           [Commercial Bank, Merchant Bank, Microfinance Bank, Fintech,
            Pension Fund Administrator, Insurance Company, Capital Market Dealer,
            Investment Adviser, Bureau de Change, All Financial Institutions]
        
        5. obligations: Array of specific things the institution must DO.
           Each obligation:
           - statement: plain English, one sentence
           - section_reference: e.g. "Section 4.1"
           - type: Operational / Reporting / Governance / One-time
           - recurring_deadline: Continuous / Daily / Monthly / Quarterly / Annual / One-time
        
        6. date_commencement: When does compliance begin? (YYYY-MM-DD or null)
        
        7. ai_summary: 3-5 sentence plain English summary. What does this require? Who does it apply to? What is the penalty?
        
        Respond ONLY with valid JSON matching this schema. No preamble or explanation.
        
        Document text:
        {OCR_TEXT}
    """;

    /**
     * Async classification — called by cron job
     */
    public void classifyAsync(Long instrumentId, String ocrText) {
        try {
            ClassificationResult result = callClaudeApi(ocrText);
            applyClassification(instrumentId, result);
            jobQueue.enqueue(JobType.EVALUATE_APPLICABILITY, instrumentId,
                Map.of("instrument_id", instrumentId, "classification", result));
        } catch (Exception e) {
            log.error("Classification failed for instrument {}: {}", instrumentId, e.getMessage());
            throw e;
        }
    }

    /**
     * Sync classification — called by admin "classify now" endpoint
     */
    public ClassificationResult classifySync(Long instrumentId, String ocrText) {
        ClassificationResult result = callClaudeApi(ocrText);
        applyClassification(instrumentId, result);
        return result;
    }

    private ClassificationResult callClaudeApi(String ocrText) {
        String prompt = CLASSIFICATION_PROMPT.replace(
            "{OCR_TEXT}",
            // Truncate to 80k chars to stay within Claude's context window
            ocrText.substring(0, Math.min(80000, ocrText.length()))
        );

        String response = claudeClient.complete(
            "claude-sonnet-4-20250514",
            prompt,
            1000   // max_tokens for JSON response
        );

        // Parse JSON response
        return objectMapper.readValue(response, ClassificationResult.class);
    }

    private void applyClassification(Long instrumentId, ClassificationResult result) {
        // Update instrument record
        instruments.updateClassification(instrumentId,
            result.getAreaOfFocus(),
            result.getThemeId(),
            result.getNature(),
            result.getRiskRating(),
            result.getLicenceTypesApplicable(),
            result.getApplicabilityConfidence(),
            result.getAiSummary(),
            "Published"
        );

        // Create obligation_mappings rows
        for (int i = 0; i < result.getObligations().size(); i++) {
            ObligationDto o = result.getObligations().get(i);
            obligations.insert(ObligationMapping.builder()
                .instrumentId(instrumentId)
                .obligationNumber(i + 1)
                .plainEnglishStatement(o.getStatement())
                .specificSectionReference(o.getSectionReference())
                .obligationType(o.getType())
                .recurringDeadlineType(o.getRecurringDeadline())
                .build()
            );
        }
    }
}
```

---

## Module 4: Tenants

Full tenant lifecycle: onboarding, profile management, webhook config, and subscription.

### Data Model

```sql
CREATE TABLE tenants (
  tenant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name      VARCHAR(500) NOT NULL,
  short_name      VARCHAR(100),

  -- Regulatory profile
  licence_type    VARCHAR(100) NOT NULL,    -- "Commercial Bank", "Fintech", etc.
  licence_number  VARCHAR(100),
  regulators      TEXT[] NOT NULL,          -- ['CBN', 'NDIC']

  -- Business profile
  product_lines   TEXT[],                   -- ['Retail Banking', 'Consumer Credit']
  employee_count  INT,
  state_of_hq     VARCHAR(100),             -- For Lagos State regulator applicability

  -- Contacts
  cco_name        VARCHAR(255),
  cco_email       VARCHAR(255),
  tech_email      VARCHAR(255),

  -- Webhook config
  webhook_url     TEXT,
  webhook_secret  VARCHAR(255),             -- HMAC signing secret (generated on onboarding)
  webhook_enabled BOOLEAN DEFAULT true,

  -- Subscription
  subscription_tier VARCHAR(50) DEFAULT 'starter',  -- starter / pro / enterprise
  is_active       BOOLEAN DEFAULT true,
  onboarded_at    TIMESTAMP,
  onboarded_by    INT,                      -- Platform admin who created this tenant

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tenant_users (
  user_id     SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  email       VARCHAR(255) NOT NULL UNIQUE,
  full_name   VARCHAR(255),
  role        VARCHAR(50) NOT NULL,   -- ADMIN / CCO / ANALYST / AUDITOR / VIEWER
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### REST API — Tenant Management (Platform Admin)

```
-- Platform admin manages tenants

GET    /api/v1/platform/tenants
       → List all tenants with subscription and webhook status

POST   /api/v1/platform/tenants
       → Onboard a new tenant
       Body: {
         "legal_name": "Guaranty Trust Bank",
         "short_name": "GTB",
         "licence_type": "Commercial Bank",
         "licence_number": "RC152772",
         "regulators": ["CBN", "NDIC", "SEC"],
         "product_lines": ["Retail Banking", "Corporate Banking"],
         "cco_email": "compliance@gtb.com",
         "tech_email": "api@gtb.com",
         "webhook_url": "https://compliance.gtb.com/webhooks/atheris",
         "subscription_tier": "pro"
       }
       Response: {
         "tenant_id": "uuid-gtb",
         "webhook_secret": "whsec_xxxx",  -- ← Only shown once. Tenant must save this.
         "api_key": "atk_xxxx",           -- ← For tenant to pull data if needed
         "message": "Tenant created. Test your webhook before going live."
       }

GET    /api/v1/platform/tenants/{id}
       → Full tenant profile

PUT    /api/v1/platform/tenants/{id}
       → Update tenant profile (name, URLs, product lines, etc.)

POST   /api/v1/platform/tenants/{id}/rotate-webhook-secret
       → Generate a new webhook signing secret

POST   /api/v1/platform/tenants/{id}/test-webhook
       → Send a test ping to the tenant's webhook endpoint
       Response: { "delivered": true, "status_code": 200, "latency_ms": 143 }

POST   /api/v1/platform/tenants/{id}/send-obligations
       → Manually re-send all published obligations to this tenant
       → Used when a new tenant joins mid-cycle and needs all existing obligations

GET    /api/v1/platform/tenants/{id}/webhook-history
       → Last 100 webhook deliveries (status, timestamp, response code)

DELETE /api/v1/platform/tenants/{id}
       → Deactivate tenant (soft delete)
```

### REST API — Tenant Self-Service

```
-- Tenant manages their own profile

GET    /api/v1/tenant/profile
       → Get own tenant profile

PUT    /api/v1/tenant/profile
       → Update own profile (webhook URL, contact details, product lines)

GET    /api/v1/tenant/users
       → List own team members

POST   /api/v1/tenant/users
       → Invite a new team member
       Body: { "email": "ngozi@gtb.com", "full_name": "Ngozi Eze", "role": "ANALYST" }

PUT    /api/v1/tenant/users/{id}
       → Update team member (role, deactivate)

GET    /api/v1/tenant/webhook/history
       → Own webhook delivery history

POST   /api/v1/tenant/webhook/test
       → Trigger a test webhook to own endpoint
```

---

## Module 5: Webhooks

### Data Model

```sql
CREATE TABLE webhook_delivery_log (
  delivery_id       BIGINT PRIMARY KEY,
  webhook_id        VARCHAR(100) UNIQUE,
  tenant_id         UUID NOT NULL,
  instrument_id     BIGINT NOT NULL,
  webhook_type      VARCHAR(100),            -- obligation.received | obligation.updated | obligation.superseded
  status            VARCHAR(50) DEFAULT 'pending', -- pending | delivered | failed | retrying
  
  -- Request
  request_payload   JSONB,
  request_signature VARCHAR(128),
  
  -- Response
  response_code     INT,
  response_body     TEXT,
  delivery_latency_ms INT,
  
  -- Retry
  attempt_count     INT DEFAULT 0,
  max_attempts      INT DEFAULT 5,
  last_error        TEXT,
  next_retry_at     TIMESTAMP,
  
  delivered_at      TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### WebhookService.java

```java
@Service
public class WebhookService {

    @Autowired private WebhookDeliveryLogRepository deliveryLog;
    @Autowired private TenantRepository tenants;

    public void deliver(String tenantId, Long instrumentId, Object payload, String webhookType) {
        Tenant tenant = tenants.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found: " + tenantId));

        if (!tenant.isWebhookEnabled() || tenant.getWebhookUrl() == null) {
            log.warn("Webhook not configured for tenant {}", tenantId);
            return;
        }

        String webhookId = generateWebhookId();
        String payloadJson = toJson(payload);
        String signature = hmacSha256(payloadJson, tenant.getWebhookSecret());

        // Record delivery attempt
        WebhookDeliveryLog log = deliveryLog.insert(WebhookDeliveryLog.builder()
            .webhookId(webhookId)
            .tenantId(tenantId)
            .instrumentId(instrumentId)
            .webhookType(webhookType)
            .status("pending")
            .requestPayload(payloadJson)
            .requestSignature(signature)
            .build()
        );

        try {
            long start = System.currentTimeMillis();

            HttpResponse<String> response = HttpClient.newHttpClient()
                .send(HttpRequest.newBuilder()
                    .uri(URI.create(tenant.getWebhookUrl()))
                    .header("Content-Type", "application/json")
                    .header("X-Atheris-Signature", "sha256=" + signature)
                    .header("X-Webhook-Event-ID", webhookId)
                    .header("X-Webhook-Timestamp", Instant.now().toString())
                    .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                    .timeout(Duration.ofSeconds(10))
                    .build(),
                    HttpResponse.BodyHandlers.ofString()
                );

            long latency = System.currentTimeMillis() - start;

            if (response.statusCode() == 200) {
                deliveryLog.markDelivered(log.getDeliveryId(), response.statusCode(),
                    response.body(), (int) latency);
            } else {
                deliveryLog.markFailed(log.getDeliveryId(),
                    "Non-200 response: " + response.statusCode(),
                    calculateNextRetry(0)
                );
            }

        } catch (Exception e) {
            deliveryLog.markFailed(log.getDeliveryId(), e.getMessage(), calculateNextRetry(0));
        }
    }

    private Instant calculateNextRetry(int attempt) {
        int[] waitMinutes = {5, 15, 60, 240, 1440}; // 5min, 15min, 1h, 4h, 1day
        int minutes = waitMinutes[Math.min(attempt, waitMinutes.length - 1)];
        return Instant.now().plus(minutes, ChronoUnit.MINUTES);
    }
}
```

---

## Module 6: Job Queue (Cron Processors)

### JobQueueProcessor.java

```java
@Component
public class JobQueueProcessors {

    @Autowired private JobQueueRepository jobQueue;
    @Autowired private PdfExtractionService pdfExtractor;
    @Autowired private ClassificationService classifier;
    @Autowired private ApplicabilityService applicability;
    @Autowired private WebhookService webhooks;
    @Autowired private StorageService storage;

    // ─────────────────────────────────────────────────────────────────
    // JOB 1: OCR PROCESSOR (every 2 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 120_000)
    @Transactional
    public void processOcrQueue() {
        jobQueue.claimOne("ocr_document").ifPresent(job -> {
            try {
                String pdfUrl = job.getPayloadField("pdf_url");
                Long regulatorId = job.getPayloadField("regulator_id");
                String title = job.getPayloadField("title");

                byte[] pdfBytes = storage.download(pdfUrl);
                String text = pdfExtractor.extractText(pdfBytes);

                Instrument instrument = createInstrument(regulatorId, title, text, pdfUrl);

                jobQueue.enqueue(JobType.CLASSIFY_INSTRUMENT, instrument.getInstrumentId(),
                    Map.of("instrument_id", instrument.getInstrumentId(), "pdf_ocr_text", text));

                jobQueue.markCompleted(job.getJobId());
                log.info("OCR job {} done. Instrument {} created.", job.getJobId(), instrument.getInstrumentId());

            } catch (Exception e) {
                jobQueue.markFailed(job.getJobId(), e.getMessage());
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // JOB 2: CLASSIFIER (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processClassifierQueue() {
        jobQueue.claimOne("classify_instrument").ifPresent(job -> {
            try {
                Long instrumentId = job.getSubjectId();
                String ocrText = job.getPayloadField("pdf_ocr_text");

                classifier.classifyAsync(instrumentId, ocrText);

                jobQueue.markCompleted(job.getJobId());

            } catch (Exception e) {
                jobQueue.markFailed(job.getJobId(), e.getMessage());
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // JOB 3: APPLICABILITY (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processApplicabilityQueue() {
        jobQueue.claimOne("evaluate_applicability").ifPresent(job -> {
            try {
                Long instrumentId = job.getSubjectId();
                List<String> matchedTenants = applicability.evaluate(instrumentId);

                jobQueue.enqueue(JobType.SEND_WEBHOOKS, instrumentId,
                    Map.of("instrument_id", instrumentId, "matching_tenants", matchedTenants));

                jobQueue.markCompleted(job.getJobId());

            } catch (Exception e) {
                jobQueue.markFailed(job.getJobId(), e.getMessage());
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // JOB 4: WEBHOOK SENDER (every 5 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void processWebhookQueue() {
        jobQueue.claimOne("send_webhooks").ifPresent(job -> {
            try {
                Long instrumentId = job.getSubjectId();
                List<String> tenantIds = job.getPayloadList("matching_tenants");

                InstrumentWebhookPayload payload = buildWebhookPayload(instrumentId);

                for (String tenantId : tenantIds) {
                    webhooks.deliver(tenantId, instrumentId, payload, "obligation.received");
                }

                jobQueue.markCompleted(job.getJobId());

            } catch (Exception e) {
                jobQueue.markFailed(job.getJobId(), e.getMessage());
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // JOB 5: WEBHOOK RETRY (every 30 minutes)
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 1_800_000)
    public void retryFailedWebhooks() {
        List<WebhookDeliveryLog> failedWebhooks = deliveryLog.findDueForRetry(10);

        for (WebhookDeliveryLog failed : failedWebhooks) {
            webhooks.retry(failed);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // JOB 6: HORIZON SCRAPER (configurable per regulator)
    // Runs every hour, checks each regulator's configured frequency
    // ─────────────────────────────────────────────────────────────────
    @Scheduled(fixedDelay = 3_600_000) // Every hour
    public void runHorizonScraper() {
        List<Regulator> activeRegulators = regulatorService.findAllActive();

        for (Regulator regulator : activeRegulators) {
            if (!regulator.isScraperEnabled()) continue;
            if (!isDue(regulator)) continue;

            try {
                scraperService.scrape(regulator);
                regulatorService.updateLastRan(regulator.getRegulatorId());
            } catch (Exception e) {
                log.error("Scraper failed for {}: {}", regulator.getAbbreviation(), e.getMessage());
                scraperService.logError(regulator.getRegulatorId(), e.getMessage());
            }
        }
    }
}
```

---

## Tenant API (Tenant-Side Spring Boot App)

Each tenant has their own Spring Boot deployment. It exposes APIs to their compliance team's frontend.

### Tenant REST API

```
-- Obligations

GET    /api/v1/obligations
       Filters: ?status=Received&risk_rating=High&theme=AML
       → Paginated list of received obligations

GET    /api/v1/obligations/{id}
       → Full obligation with linked controls, sanctions, and obligations

PUT    /api/v1/obligations/{id}/classify
       → Compliance team classifies the obligation
       Body: {
         "is_applicable": true,
         "applicability_reasoning": "GTB operates ATMs in 500+ locations",
         "tenant_risk_rating": "High",
         "risk_rating_reasoning": "₦1m per branch penalty, actively enforced",
         "assigned_owner_user_id": 123,
         "linked_control_ids": [44, 45]
       }

PUT    /api/v1/obligations/{id}/mark-inapplicable
       → Mark obligation as not applicable
       Body: { "reasoning": "GTB does not hold a capital markets licence" }

-- Controls

GET    /api/v1/controls
       Filters: ?theme=AML&owner_user_id=123&status=Active
       → List controls with latest test result

POST   /api/v1/controls
       → Create a new control
       Body: {
         "control_number": "CTRL-046",
         "name": "Monthly PEP Screening Review",
         "theme": "AML/CFT",
         "control_type": "Manual Review",
         "what_it_does": "Monthly review of all customer accounts...",
         "control_owner_user_id": 123,
         "test_frequency": "Monthly",
         "linked_obligation_ids": [4821]
       }

PUT    /api/v1/controls/{id}
       → Update control details

-- Control Tests

POST   /api/v1/controls/{id}/tests
       → Record a control test result
       Body: {
         "test_date": "2026-06-13",
         "result": "Passed",
         "result_description": "All ATMs funded within 24h. Zero exceptions.",
         "evidence_file": <multipart file>
       }

GET    /api/v1/controls/{id}/tests
       → Test history for a control

-- Findings

GET    /api/v1/findings
       Filters: ?status=Open&severity=High
       → Paginated list of findings

PUT    /api/v1/findings/{id}/assign
       → Assign finding to a remediation owner

PUT    /api/v1/findings/{id}/remediate
       → Submit remediation evidence
       Body: {
         "remediation_notes": "Cash forecasting system restored...",
         "evidence_file": <multipart file>
       }

PUT    /api/v1/findings/{id}/close
       → CCO closes a finding (requires CCO role)

-- Returns

GET    /api/v1/returns
       → All regulatory returns with next due date and status

GET    /api/v1/returns/calendar
       → Returns due in the next 30/60/90 days (calendar view)

PUT    /api/v1/returns/{id}/instances/{instanceId}/submit
       → Mark a return as submitted
       Body: {
         "submitted_date": "2026-06-10",
         "submission_evidence": <multipart file>
       }

-- Dashboard

GET    /api/v1/dashboard/summary
       → Live compliance score, counts, overdue items

GET    /api/v1/dashboard/board-pack
       → Generate board pack data (all metrics)

POST   /api/v1/dashboard/board-pack/export
       → Generate and download board pack as PDF

-- Audit

GET    /api/v1/audit?subject_type=obligation&subject_id=4821
       → Audit trail for a specific subject

-- Users

GET    /api/v1/users
       → Team members

POST   /api/v1/users/invite
       → Invite new team member

PUT    /api/v1/users/{id}/role
       → Change role
```

---

## Authentication & Authorization

### Roles

```
Platform level:
  PLATFORM_ADMIN   → Manage regulators, tenants, instruments, jobs

Tenant level:
  TENANT_ADMIN     → Manage own users, profile, webhook config
  CCO              → Approve findings, sign off returns, view all
  ANALYST          → Classify obligations, test controls, record results
  AUDITOR          → Read-only + raise independent audit findings
  VIEWER           → Read-only access (for board members, examiners)
```

### SecurityConfig.java (Platform)

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/webhooks/**").permitAll()  // Tenants receive webhooks
                // Platform admin only
                .requestMatchers("/api/v1/platform/**").hasRole("PLATFORM_ADMIN")
                // All authenticated
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

---

## application.yml (Platform)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:5432/atheris_platform
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 55MB

atheris:
  storage:
    provider: s3            # s3 | minio (for self-hosted)
    bucket: atheris-platform-docs
    region: ${AWS_REGION}
  
  ai:
    provider: anthropic
    api-key: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514
    max-tokens: 1000
  
  scraper:
    user-agent: "Atheris-HorizonScanner/1.0 (compliance@atheris.com)"
    request-timeout-seconds: 30
    max-pdf-size-mb: 50
  
  jobs:
    ocr-processor-interval-ms: 120000       # 2 min
    classifier-interval-ms: 300000          # 5 min
    applicability-interval-ms: 300000       # 5 min
    webhook-sender-interval-ms: 300000      # 5 min
    webhook-retry-interval-ms: 1800000      # 30 min
    scraper-interval-ms: 3600000            # 1 hour
```

---

## Folder Structure

```
atheris-platform/
├── pom.xml
├── src/main/java/com/atheris/platform/
│   ├── AtherisPlatformApplication.java
│   │
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── JwtAuthFilter.java
│   │   ├── S3Config.java
│   │   └── SchedulingConfig.java
│   │
│   ├── modules/
│   │   ├── regulators/
│   │   │   ├── Regulator.java               (Entity)
│   │   │   ├── RegulatorRepository.java
│   │   │   ├── RegulatorService.java
│   │   │   ├── RegulatorController.java
│   │   │   ├── ScraperService.java
│   │   │   └── dto/
│   │   │       ├── CreateRegulatorRequest.java
│   │   │       ├── UpdateRegulatorRequest.java
│   │   │       └── RegulatorDto.java
│   │   │
│   │   ├── instruments/
│   │   │   ├── Instrument.java
│   │   │   ├── InstrumentRepository.java
│   │   │   ├── InstrumentService.java
│   │   │   ├── DocumentUploadController.java
│   │   │   ├── InstrumentController.java
│   │   │   └── dto/
│   │   │
│   │   ├── obligations/
│   │   │   ├── ObligationMapping.java
│   │   │   ├── ObligationMappingRepository.java
│   │   │   └── ObligationMappingService.java
│   │   │
│   │   ├── sanctions/
│   │   │   ├── SanctionsPenalty.java
│   │   │   └── SanctionsRepository.java
│   │   │
│   │   ├── classification/
│   │   │   ├── ClassificationService.java
│   │   │   └── dto/ClassificationResult.java
│   │   │
│   │   ├── applicability/
│   │   │   ├── ApplicabilityService.java
│   │   │   └── TenantEligibilityRule.java
│   │   │
│   │   ├── tenants/
│   │   │   ├── Tenant.java
│   │   │   ├── TenantUser.java
│   │   │   ├── TenantRepository.java
│   │   │   ├── TenantService.java
│   │   │   ├── TenantController.java        (Platform admin manages)
│   │   │   ├── TenantSelfController.java    (Tenant manages own profile)
│   │   │   └── dto/
│   │   │
│   │   ├── webhooks/
│   │   │   ├── WebhookDeliveryLog.java
│   │   │   ├── WebhookDeliveryLogRepository.java
│   │   │   ├── WebhookService.java
│   │   │   └── WebhookController.java
│   │   │
│   │   └── jobs/
│   │       ├── JobQueue.java
│   │       ├── JobQueueRepository.java
│   │       ├── JobQueueService.java
│   │       └── JobQueueProcessors.java      (All @Scheduled methods)
│   │
│   └── shared/
│       ├── ocr/
│       │   └── PdfExtractionService.java
│       ├── storage/
│       │   └── StorageService.java
│       ├── ai/
│       │   └── AnthropicClient.java
│       └── audit/
│           └── AuditService.java

atheris-tenant/
├── pom.xml
├── src/main/java/com/atheris/tenant/
│   ├── AtherisTenantApplication.java
│   ├── config/
│   ├── modules/
│   │   ├── obligations/
│   │   ├── controls/
│   │   ├── findings/
│   │   ├── returns/
│   │   ├── users/
│   │   ├── dashboard/
│   │   ├── audit/
│   │   └── webhooks/         ← Receives webhooks from platform
│   └── shared/
```


---

## 6 — User Management & Tenant Isolation


## Overview

Two completely separate user systems:

```
1. Platform Users    → Atheris staff. Manage regulators, tenants, instruments.
                       One database: atheris_platform
                       
2. Tenant Users      → Bank/fintech/pension staff. Use the compliance platform.
                       Each tenant: their own isolated database schema
                       atheris_tenant_{tenant_id}
```

They never share a users table. A platform admin cannot log into a tenant's app as a user, and a tenant user cannot see another tenant's data.

---

## Part 1 — Database Schema

---

### Platform Database: `atheris_platform`

#### `platform_users`

```sql
CREATE TABLE platform_users (
  user_id         SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,    -- bcrypt
  role            VARCHAR(50)  NOT NULL DEFAULT 'PLATFORM_ADMIN',
  -- Only one role for now: PLATFORM_ADMIN
  -- Future: PLATFORM_SUPPORT (read-only), PLATFORM_ENGINEER

  -- Status
  is_active       BOOLEAN DEFAULT true,
  email_verified  BOOLEAN DEFAULT false,

  -- Security
  mfa_enabled     BOOLEAN DEFAULT false,
  mfa_secret      VARCHAR(255),             -- TOTP secret (encrypted at rest)
  failed_login_attempts INT DEFAULT 0,
  locked_until    TIMESTAMP,               -- Temporary lockout after 5 failed attempts

  -- Audit
  last_login_at   TIMESTAMP,
  last_login_ip   VARCHAR(45),
  password_changed_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### Tenant Database: `atheris_tenant_{tenant_id}`

Each tenant gets their own PostgreSQL schema. All tables below live inside it.

#### `tenant_profile`

This is the tenant's own copy of their profile — who they are, which regulators they are subscribed to, their subscription tier.

```sql
CREATE TABLE tenant_profile (
  profile_id      SERIAL PRIMARY KEY,       -- Always one row per tenant DB
  tenant_id       UUID NOT NULL,            -- Matches central platform tenant_id
  legal_name      VARCHAR(500) NOT NULL,
  short_name      VARCHAR(100),

  -- Regulatory identity
  licence_type    VARCHAR(100) NOT NULL,
  licence_number  VARCHAR(100),
  state_of_hq     VARCHAR(100),

  -- Subscribed regulators
  -- These are the regulators the tenant wants to receive obligations from
  -- Subset of all 43 regulators. e.g. ['CBN', 'NDIC', 'NDPC']
  subscribed_regulators TEXT[] NOT NULL,

  -- Business profile (used for applicability routing)
  product_lines   TEXT[],                  -- ['Retail Banking', 'Consumer Credit']
  employee_count  INT,

  -- Contacts
  cco_name        VARCHAR(255),
  cco_email       VARCHAR(255),
  tech_email      VARCHAR(255),

  -- Webhook config
  webhook_url     TEXT,
  webhook_enabled BOOLEAN DEFAULT true,

  -- Subscription
  subscription_tier VARCHAR(50) DEFAULT 'starter',
  -- starter   → up to 5 users, 1 regulator subscription
  -- pro       → up to 20 users, all regulators
  -- enterprise → unlimited users, custom features

  subscription_expires_at TIMESTAMP,
  is_active       BOOLEAN DEFAULT true,

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

**Why a copy in the tenant DB?**
The central platform has its own `tenants` table for routing. But the tenant's own app needs to know its own profile for UI display, subscription checks, and filtering obligations by `subscribed_regulators`. Keeping a copy in the tenant DB means the tenant app never needs to call back to the platform for its own profile.

---

#### `users`

```sql
CREATE TABLE users (
  user_id         SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  job_title       VARCHAR(100),
  department      VARCHAR(100),
  password_hash   VARCHAR(255),             -- NULL until user sets password via invite

  -- Role-based access
  role            VARCHAR(50) NOT NULL,
  -- TENANT_ADMIN  → manage users, profile, webhook, subscription
  -- CCO           → approve findings, sign off returns, generate board pack
  -- ANALYST       → classify obligations, test controls, manage findings
  -- AUDITOR       → read-only + raise independent audit findings
  -- VIEWER        → read-only (board members, CBN examiners)

  -- Manager relationship (for escalation chains)
  manager_user_id INT REFERENCES users(user_id),

  -- Status
  is_active       BOOLEAN DEFAULT true,
  email_verified  BOOLEAN DEFAULT false,

  -- Invite state
  invite_status   VARCHAR(50) DEFAULT 'pending',
  -- pending    → invited, not yet accepted
  -- active     → accepted invite, password set
  -- deactivated → no longer active

  -- Security
  mfa_enabled     BOOLEAN DEFAULT false,
  mfa_secret      VARCHAR(255),
  failed_login_attempts INT DEFAULT 0,
  locked_until    TIMESTAMP,

  -- Audit
  invited_by_user_id INT REFERENCES users(user_id),
  invited_at      TIMESTAMP,
  last_login_at   TIMESTAMP,
  last_login_ip   VARCHAR(45),
  password_changed_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `invite_tokens`

Stores the one-time invite token sent to new users by email.

```sql
CREATE TABLE invite_tokens (
  token_id        SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(user_id),
  token           VARCHAR(128) NOT NULL UNIQUE, -- cryptographically random
  token_hash      VARCHAR(64) NOT NULL,          -- SHA256 of token (we store hash, not raw)
  
  -- What is this token for?
  token_type      VARCHAR(50) NOT NULL,
  -- 'invite'            → new user accepting invite
  -- 'password_reset'    → existing user resetting password

  -- Expiry
  expires_at      TIMESTAMP NOT NULL,           -- 72 hours for invite, 1 hour for reset
  used_at         TIMESTAMP,                    -- NULL = not yet used
  is_used         BOOLEAN DEFAULT false,

  -- Audit
  created_by_user_id INT,                       -- Who sent the invite?
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `refresh_tokens`

JWT access tokens are short-lived (15 min). Refresh tokens are long-lived (30 days) and stored here.

```sql
CREATE TABLE refresh_tokens (
  token_id        SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(user_id),
  token_hash      VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 of actual token
  
  -- Device/session info
  device_name     VARCHAR(255),                 -- e.g. "Chrome on Windows"
  ip_address      VARCHAR(45),
  user_agent      TEXT,

  -- Lifecycle
  expires_at      TIMESTAMP NOT NULL,           -- 30 days from issue
  last_used_at    TIMESTAMP,
  is_revoked      BOOLEAN DEFAULT false,
  revoked_at      TIMESTAMP,
  revoked_reason  VARCHAR(100),                 -- 'logout' | 'password_change' | 'admin_revoke'

  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `role_permissions` (Reference table)

Maps each role to exactly what it can do. Used by the API to enforce access.

```sql
CREATE TABLE role_permissions (
  permission_id   SERIAL PRIMARY KEY,
  role            VARCHAR(50) NOT NULL,
  resource        VARCHAR(100) NOT NULL,   -- e.g. 'obligations', 'controls', 'findings'
  action          VARCHAR(50) NOT NULL,    -- e.g. 'read', 'write', 'approve', 'delete'
  allowed         BOOLEAN DEFAULT true,
  
  UNIQUE (role, resource, action)
);

-- Seed data
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- TENANT_ADMIN
('TENANT_ADMIN', 'users',         'read',     true),
('TENANT_ADMIN', 'users',         'invite',   true),
('TENANT_ADMIN', 'users',         'deactivate', true),
('TENANT_ADMIN', 'profile',       'read',     true),
('TENANT_ADMIN', 'profile',       'write',    true),
('TENANT_ADMIN', 'obligations',   'read',     true),
('TENANT_ADMIN', 'obligations',   'write',    true),
('TENANT_ADMIN', 'controls',      'read',     true),
('TENANT_ADMIN', 'controls',      'write',    true),
('TENANT_ADMIN', 'findings',      'read',     true),
('TENANT_ADMIN', 'findings',      'write',    true),
('TENANT_ADMIN', 'returns',       'read',     true),
('TENANT_ADMIN', 'audit_log',     'read',     true),

-- CCO
('CCO', 'obligations',   'read',     true),
('CCO', 'obligations',   'write',    true),
('CCO', 'controls',      'read',     true),
('CCO', 'controls',      'write',    true),
('CCO', 'findings',      'read',     true),
('CCO', 'findings',      'approve',  true),  -- CCO-only action
('CCO', 'findings',      'close',    true),  -- CCO-only action
('CCO', 'returns',       'read',     true),
('CCO', 'returns',       'approve',  true),  -- CCO-only action
('CCO', 'dashboard',     'read',     true),
('CCO', 'board_pack',    'generate', true),  -- CCO-only action
('CCO', 'audit_log',     'read',     true),
('CCO', 'users',         'read',     true),

-- ANALYST
('ANALYST', 'obligations',  'read',     true),
('ANALYST', 'obligations',  'classify', true),
('ANALYST', 'controls',     'read',     true),
('ANALYST', 'controls',     'write',    true),
('ANALYST', 'controls',     'test',     true),
('ANALYST', 'findings',     'read',     true),
('ANALYST', 'findings',     'write',    true),   -- Can raise and edit findings
('ANALYST', 'findings',     'approve',  false),  -- Cannot approve own findings
('ANALYST', 'returns',      'read',     true),
('ANALYST', 'returns',      'prepare',  true),
('ANALYST', 'dashboard',    'read',     true),
('ANALYST', 'audit_log',    'read',     false),  -- Analysts cannot see full audit log

-- AUDITOR
('AUDITOR', 'obligations',  'read',     true),
('AUDITOR', 'controls',     'read',     true),
('AUDITOR', 'findings',     'read',     true),
('AUDITOR', 'findings',     'write',    true),   -- Can raise audit findings
('AUDITOR', 'returns',      'read',     true),
('AUDITOR', 'audit_log',    'read',     true),   -- Full audit trail access
('AUDITOR', 'dashboard',    'read',     true),

-- VIEWER (board members, CBN examiners with portal access)
('VIEWER', 'obligations',   'read',     true),
('VIEWER', 'controls',      'read',     true),
('VIEWER', 'findings',      'read',     true),
('VIEWER', 'returns',       'read',     true),
('VIEWER', 'dashboard',     'read',     true),
('VIEWER', 'audit_log',     'read',     false);  -- Viewers cannot see audit log
```

---

## Part 2 — The Invite Flow

This is the exact flow from admin sending an invite to user logging in for the first time.

```
TENANT_ADMIN sends invite
        ↓
System creates user record (password_hash = NULL)
        ↓
System generates cryptographically random token
        ↓
Token hash stored in invite_tokens table
        ↓
Email sent to user with link:
  https://app.atheris.com/accept-invite?token=<raw_token>
        ↓
User clicks link in email
        ↓
Frontend sends token to API: POST /auth/accept-invite
        ↓
API verifies token (hash lookup, not expired, not used)
        ↓
User sets their password (frontend form)
        ↓
API hashes password, saves to users table
        ↓
invite_tokens row marked used_at = NOW()
        ↓
User is now active — can log in
```

---

## Part 3 — AuthService.java

```java
@Service
@Slf4j
public class AuthService {

    @Autowired private UserRepository users;
    @Autowired private InviteTokenRepository inviteTokens;
    @Autowired private RefreshTokenRepository refreshTokens;
    @Autowired private EmailService emailService;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;

    private static final int INVITE_EXPIRY_HOURS = 72;
    private static final int PASSWORD_RESET_EXPIRY_HOURS = 1;
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    // ─────────────────────────────────────────────────────────────────
    // STEP 1: ADMIN INVITES A USER
    // ─────────────────────────────────────────────────────────────────

    public void inviteUser(InviteUserRequest req, Integer invitedByUserId) {

        // 1. Check email not already taken
        if (users.existsByEmail(req.getEmail())) {
            throw new ConflictException("A user with this email already exists.");
        }

        // 2. Create user record — no password yet
        User user = User.builder()
            .email(req.getEmail().toLowerCase().trim())
            .fullName(req.getFullName())
            .jobTitle(req.getJobTitle())
            .department(req.getDepartment())
            .role(req.getRole())
            .inviteStatus("pending")
            .invitedByUserId(invitedByUserId)
            .invitedAt(Instant.now())
            .isActive(true)
            .emailVerified(false)
            .build();

        users.save(user);

        // 3. Generate invite token
        String rawToken = generateSecureToken();         // 128-char random string
        String tokenHash = sha256Hex(rawToken);          // Store hash, not raw

        inviteTokens.insert(InviteToken.builder()
            .userId(user.getUserId())
            .token(rawToken)                             // Raw token goes into the email link
            .tokenHash(tokenHash)                        // Hash stored in DB
            .tokenType("invite")
            .expiresAt(Instant.now().plus(INVITE_EXPIRY_HOURS, ChronoUnit.HOURS))
            .createdByUserId(invitedByUserId)
            .build()
        );

        // 4. Send invite email
        String inviteLink = baseUrl + "/accept-invite?token=" + rawToken;

        emailService.sendInviteEmail(
            user.getEmail(),
            user.getFullName(),
            inviteLink,
            INVITE_EXPIRY_HOURS
        );

        // 5. Audit log
        auditService.log(invitedByUserId, "user_invited", "user", user.getUserId(),
            Map.of("email", user.getEmail(), "role", user.getRole()));

        log.info("Invite sent to {} (role: {})", user.getEmail(), user.getRole());
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 2: USER CLICKS LINK — VALIDATE TOKEN
    // Called when user opens the invite link.
    // Just validates token and returns user info for the "Set Password" form.
    // ─────────────────────────────────────────────────────────────────

    public InviteTokenValidationResult validateInviteToken(String rawToken) {

        String tokenHash = sha256Hex(rawToken);

        InviteToken token = inviteTokens.findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("Invite link is invalid."));

        // Check not already used
        if (token.isUsed()) {
            throw new InvalidTokenException(
                "This invite link has already been used. Please contact your admin.");
        }

        // Check not expired
        if (Instant.now().isAfter(token.getExpiresAt())) {
            throw new InvalidTokenException(
                "This invite link has expired (valid for 72 hours). " +
                "Please ask your admin to send a new invite.");
        }

        User user = users.findById(token.getUserId())
            .orElseThrow(() -> new InvalidTokenException("User not found."));

        return InviteTokenValidationResult.builder()
            .email(user.getEmail())
            .fullName(user.getFullName())
            .role(user.getRole())
            .tokenValid(true)
            .build();
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 3: USER SETS THEIR PASSWORD
    // Called after user fills in the "Set Password" form.
    // ─────────────────────────────────────────────────────────────────

    public AuthTokens acceptInvite(AcceptInviteRequest req) {

        String tokenHash = sha256Hex(req.getToken());

        InviteToken token = inviteTokens.findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("Invite link is invalid."));

        // Re-validate (same checks as above — token might have expired since validation)
        if (token.isUsed()) throw new InvalidTokenException("Invite already used.");
        if (Instant.now().isAfter(token.getExpiresAt()))
            throw new InvalidTokenException("Invite link has expired.");

        // Validate password strength
        validatePasswordStrength(req.getPassword());

        // Confirm passwords match
        if (!req.getPassword().equals(req.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match.");
        }

        // Update user: set password, mark active
        User user = users.findById(token.getUserId()).orElseThrow();
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setEmailVerified(true);
        user.setInviteStatus("active");
        user.setPasswordChangedAt(Instant.now());
        users.save(user);

        // Mark token as used
        inviteTokens.markUsed(token.getTokenId());

        // Log the user in immediately — no need to log in again after accepting
        AuthTokens tokens = issueTokens(user, req.getDeviceName(), req.getIpAddress());

        auditService.log(user.getUserId(), "invite_accepted", "user", user.getUserId(),
            Map.of("email", user.getEmail()));

        log.info("User {} accepted invite and set password.", user.getEmail());

        return tokens;
    }

    // ─────────────────────────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────────────────────────

    public AuthTokens login(LoginRequest req) {

        User user = users.findByEmail(req.getEmail().toLowerCase())
            .orElseThrow(() -> new AuthException("Invalid email or password."));

        // Check account is active
        if (!user.isActive()) {
            throw new AuthException("Your account has been deactivated. Contact your admin.");
        }

        // Check invite is accepted
        if ("pending".equals(user.getInviteStatus())) {
            throw new AuthException(
                "You have not accepted your invite yet. " +
                "Please check your email for the invite link.");
        }

        // Check not locked out
        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            long minutesLeft = ChronoUnit.MINUTES.between(Instant.now(), user.getLockedUntil());
            throw new AuthException(
                "Account temporarily locked. Try again in " + minutesLeft + " minutes.");
        }

        // Verify password
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            handleFailedLogin(user);
            throw new AuthException("Invalid email or password.");
        }

        // Reset failed attempts on successful login
        users.resetFailedAttempts(user.getUserId());
        users.updateLastLogin(user.getUserId(), Instant.now(), req.getIpAddress());

        AuthTokens tokens = issueTokens(user, req.getDeviceName(), req.getIpAddress());

        auditService.log(user.getUserId(), "login", "user", user.getUserId(),
            Map.of("ip", req.getIpAddress(), "device", req.getDeviceName()));

        return tokens;
    }

    // ─────────────────────────────────────────────────────────────────
    // TOKEN REFRESH
    // ─────────────────────────────────────────────────────────────────

    public AuthTokens refreshTokens(String rawRefreshToken) {

        String tokenHash = sha256Hex(rawRefreshToken);

        RefreshToken stored = refreshTokens.findByTokenHash(tokenHash)
            .orElseThrow(() -> new AuthException("Invalid refresh token."));

        if (stored.isRevoked()) throw new AuthException("Refresh token has been revoked.");
        if (Instant.now().isAfter(stored.getExpiresAt()))
            throw new AuthException("Refresh token has expired. Please log in again.");

        User user = users.findById(stored.getUserId()).orElseThrow();
        if (!user.isActive()) throw new AuthException("Account deactivated.");

        // Rotate refresh token — invalidate old, issue new
        refreshTokens.revoke(stored.getTokenId(), "rotated");
        return issueTokens(user, stored.getDeviceName(), stored.getIpAddress());
    }

    // ─────────────────────────────────────────────────────────────────
    // LOGOUT
    // ─────────────────────────────────────────────────────────────────

    public void logout(String rawRefreshToken, Integer userId) {
        String tokenHash = sha256Hex(rawRefreshToken);
        refreshTokens.findByTokenHash(tokenHash)
            .ifPresent(t -> refreshTokens.revoke(t.getTokenId(), "logout"));

        auditService.log(userId, "logout", "user", userId, Map.of());
    }

    // ─────────────────────────────────────────────────────────────────
    // PASSWORD RESET — STEP 1: REQUEST RESET
    // ─────────────────────────────────────────────────────────────────

    public void requestPasswordReset(String email) {
        // Always return success — don't reveal if email exists (security best practice)
        users.findByEmail(email.toLowerCase()).ifPresent(user -> {
            if (!user.isActive()) return;

            String rawToken = generateSecureToken();
            inviteTokens.insert(InviteToken.builder()
                .userId(user.getUserId())
                .token(rawToken)
                .tokenHash(sha256Hex(rawToken))
                .tokenType("password_reset")
                .expiresAt(Instant.now().plus(PASSWORD_RESET_EXPIRY_HOURS, ChronoUnit.HOURS))
                .build()
            );

            String resetLink = baseUrl + "/reset-password?token=" + rawToken;
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), resetLink);

            auditService.log(user.getUserId(), "password_reset_requested",
                "user", user.getUserId(), Map.of());
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // PASSWORD RESET — STEP 2: SET NEW PASSWORD
    // ─────────────────────────────────────────────────────────────────

    public void resetPassword(ResetPasswordRequest req) {
        String tokenHash = sha256Hex(req.getToken());

        InviteToken token = inviteTokens.findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("Reset link is invalid."));

        if (token.isUsed()) throw new InvalidTokenException("Reset link already used.");
        if (Instant.now().isAfter(token.getExpiresAt()))
            throw new InvalidTokenException("Reset link has expired (valid 1 hour).");
        if (!"password_reset".equals(token.getTokenType()))
            throw new InvalidTokenException("Invalid token type.");

        validatePasswordStrength(req.getNewPassword());

        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw new BadRequestException("Passwords do not match.");

        User user = users.findById(token.getUserId()).orElseThrow();
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        user.setPasswordChangedAt(Instant.now());
        users.save(user);

        // Revoke ALL existing refresh tokens — forces re-login everywhere
        refreshTokens.revokeAllForUser(user.getUserId(), "password_reset");

        inviteTokens.markUsed(token.getTokenId());

        auditService.log(user.getUserId(), "password_reset_completed",
            "user", user.getUserId(), Map.of());
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private AuthTokens issueTokens(User user, String deviceName, String ipAddress) {
        // Short-lived JWT access token (15 minutes)
        String accessToken = jwtService.generateAccessToken(
            user.getUserId(),
            user.getEmail(),
            user.getRole()
        );

        // Long-lived refresh token (30 days)
        String rawRefreshToken = generateSecureToken();
        refreshTokens.insert(RefreshToken.builder()
            .userId(user.getUserId())
            .tokenHash(sha256Hex(rawRefreshToken))
            .deviceName(deviceName)
            .ipAddress(ipAddress)
            .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
            .build()
        );

        return AuthTokens.builder()
            .accessToken(accessToken)
            .refreshToken(rawRefreshToken)
            .accessTokenExpiresIn(900)      // 15 minutes in seconds
            .tokenType("Bearer")
            .user(UserSummaryDto.from(user))
            .build();
    }

    private void handleFailedLogin(User user) {
        int attempts = user.getFailedLoginAttempts() + 1;

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            users.lockAccount(user.getUserId(),
                Instant.now().plus(LOCKOUT_MINUTES, ChronoUnit.MINUTES));
            log.warn("Account locked: {} after {} failed attempts", user.getEmail(), attempts);
        } else {
            users.incrementFailedAttempts(user.getUserId());
        }
    }

    private void validatePasswordStrength(String password) {
        if (password == null || password.length() < 8)
            throw new BadRequestException("Password must be at least 8 characters.");
        if (!password.matches(".*[A-Z].*"))
            throw new BadRequestException("Password must contain at least one uppercase letter.");
        if (!password.matches(".*[0-9].*"))
            throw new BadRequestException("Password must contain at least one number.");
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*"))
            throw new BadRequestException("Password must contain at least one special character.");
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[96];  // 96 bytes → 128 char hex string
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
```

---

## Part 4 — JwtService.java

```java
@Service
public class JwtService {

    @Value("${atheris.jwt.secret}")
    private String jwtSecret;

    private static final long ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

    /**
     * Generate a signed JWT access token.
     * Contains: userId, email, role, tenantId.
     * Short-lived: 15 minutes.
     */
    public String generateAccessToken(Integer userId, String email, String role) {
        return Jwts.builder()
            .setSubject(String.valueOf(userId))
            .claim("email", email)
            .claim("role", role)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_EXPIRY_MS))
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    /**
     * Validate and parse a JWT.
     * Returns claims if valid, throws if expired or tampered.
     */
    public Claims validateToken(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    public Integer extractUserId(String token) {
        return Integer.parseInt(validateToken(token).getSubject());
    }

    public String extractRole(String token) {
        return validateToken(token).get("role", String.class);
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
```

---

## Part 5 — JwtAuthFilter.java

```java
@Component
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired private JwtService jwtService;
    @Autowired private UserRepository users;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
        throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // No token — skip filter, Spring Security will handle as unauthenticated
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            Claims claims = jwtService.validateToken(token);
            Integer userId = Integer.parseInt(claims.getSubject());
            String role = claims.get("role", String.class);

            // Load user from DB to get full details and verify still active
            User user = users.findById(userId).orElse(null);
            if (user == null || !user.isActive()) {
                chain.doFilter(request, response);
                return;
            }

            // Build Spring Security authentication object
            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(
                    user,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );

            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (ExpiredJwtException e) {
            log.debug("JWT expired: {}", e.getMessage());
            // Let Spring Security return 401
        } catch (JwtException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
        }

        chain.doFilter(request, response);
    }
}
```

---

## Part 6 — REST API (Auth + User Management)

### Auth Endpoints (Public — no token required)

```
POST   /api/v1/auth/login
       Body: { "email": "ngozi@gtb.com", "password": "...",
               "device_name": "Chrome on Mac" }
       Response: { "access_token": "...", "refresh_token": "...",
                   "expires_in": 900, "user": { ... } }

POST   /api/v1/auth/refresh
       Body: { "refresh_token": "..." }
       Response: { "access_token": "...", "refresh_token": "...", "expires_in": 900 }

POST   /api/v1/auth/logout
       Body: { "refresh_token": "..." }
       Response: 200 OK

GET    /api/v1/auth/invite/validate?token=xxx
       → Validate invite token before showing "Set Password" form
       Response: { "email": "ngozi@gtb.com", "full_name": "Ngozi Eze",
                   "role": "ANALYST", "token_valid": true }

POST   /api/v1/auth/invite/accept
       Body: { "token": "xxx", "password": "...", "confirm_password": "..." }
       Response: { "access_token": "...", "refresh_token": "..." }
       → User is logged in immediately after accepting

POST   /api/v1/auth/password/reset-request
       Body: { "email": "ngozi@gtb.com" }
       Response: 200 OK (always — even if email not found)

POST   /api/v1/auth/password/reset
       Body: { "token": "xxx", "new_password": "...", "confirm_password": "..." }
       Response: 200 OK
```

### User Management Endpoints (Authenticated)

```
-- Who am I?
GET    /api/v1/users/me
       → Current user's profile, role, permissions

PUT    /api/v1/users/me
       → Update own profile (name, job title, department — not role)

PUT    /api/v1/users/me/password
       Body: { "current_password": "...", "new_password": "...",
               "confirm_password": "..." }
       → Change own password

GET    /api/v1/users/me/sessions
       → List all active refresh token sessions (device, IP, last used)

DELETE /api/v1/users/me/sessions/{session_id}
       → Revoke a specific session (log out on that device)

-- Team management (TENANT_ADMIN only)
GET    /api/v1/users
       → List all users in this tenant

POST   /api/v1/users/invite
       Body: { "email": "emeka@gtb.com", "full_name": "Emeka Obi",
               "role": "ANALYST", "job_title": "Head, Operations",
               "department": "Operations Compliance" }
       → Send invite email to new user

POST   /api/v1/users/{id}/resend-invite
       → Resend invite email (generates a new token, invalidates old)

PUT    /api/v1/users/{id}/role
       Body: { "role": "CCO" }
       → Change a user's role (TENANT_ADMIN only)

PUT    /api/v1/users/{id}/deactivate
       → Deactivate a user — revokes all sessions, blocks login

PUT    /api/v1/users/{id}/reactivate
       → Reactivate a previously deactivated user
```

---

## Part 7 — Tenant Isolation

### How It Works

Each tenant gets a completely separate PostgreSQL schema:

```
Database: atheris_saas
  ├── Schema: platform          → Central platform tables (regulators, instruments, etc.)
  ├── Schema: tenant_a1b2c3     → GTB's data
  ├── Schema: tenant_d4e5f6     → Access Bank's data
  └── Schema: tenant_g7h8i9     → Zenith Bank's data
```

GTB's compliance officer connects and only ever sees `tenant_a1b2c3`. She cannot even see that `tenant_d4e5f6` exists.

### Why Separate Schemas Instead of a Shared Table?

The alternative — one shared table with a `tenant_id` column — is simpler to build but has risks:

| Risk | Shared Table | Separate Schema |
|---|---|---|
| Developer mistake exposes data | One missing WHERE clause exposes all tenants | Impossible — wrong schema |
| CBN examiner sees other banks | Possible bug | Impossible |
| Tenant data can be individually backed up | No | Yes |
| Schema can differ per tenant (future) | Hard | Easy |

For a financial compliance platform, separate schemas is the right choice.

### TenantContextHolder.java

Every API request from a tenant user carries their `tenant_id` in the JWT. The filter sets the schema before any DB query runs.

```java
/**
 * Holds the current tenant's schema name for the duration of a request.
 * Uses a thread-local so each request thread has its own value.
 */
public class TenantContextHolder {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setTenant(String tenantId) {
        // Schema name is derived from tenant_id
        // e.g. tenant_id "a1b2c3" → schema "tenant_a1b2c3"
        CURRENT_TENANT.set("tenant_" + tenantId.replace("-", "_"));
    }

    public static String getCurrentSchema() {
        String schema = CURRENT_TENANT.get();
        if (schema == null) throw new IllegalStateException("No tenant context set");
        return schema;
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
```

### TenantSchemaFilter.java

```java
/**
 * Runs on every API request.
 * Extracts tenant_id from the JWT and sets the PostgreSQL search_path
 * so all queries in this request go to the correct tenant schema.
 */
@Component
@Order(2)  // Runs after JwtAuthFilter (Order 1)
public class TenantSchemaFilter extends OncePerRequestFilter {

    @Autowired private DataSource dataSource;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
        throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.getPrincipal() instanceof User user) {

            // Platform admins do not have a tenant schema
            if ("PLATFORM_ADMIN".equals(user.getRole())) {
                chain.doFilter(request, response);
                return;
            }

            // Set the tenant context
            TenantContextHolder.setTenant(user.getTenantId());

            // Set PostgreSQL search_path to isolate this request to the tenant's schema
            try (Connection conn = dataSource.getConnection()) {
                String schema = TenantContextHolder.getCurrentSchema();

                // Validate schema name to prevent SQL injection
                if (!schema.matches("tenant_[a-z0-9_]+")) {
                    throw new SecurityException("Invalid tenant schema: " + schema);
                }

                conn.createStatement()
                    .execute("SET search_path TO " + schema + ", public");
            }
        }

        try {
            chain.doFilter(request, response);
        } finally {
            // ALWAYS clear the tenant context after request completes
            TenantContextHolder.clear();
        }
    }
}
```

### Schema Provisioning on Tenant Onboarding

When the platform admin creates a new tenant, the system automatically provisions their schema:

```java
@Service
public class TenantProvisioningService {

    @Autowired private DataSource dataSource;

    /**
     * Called when a new tenant is onboarded.
     * Creates their isolated PostgreSQL schema and all required tables.
     */
    @Transactional
    public void provisionTenant(String tenantId) {
        String schema = "tenant_" + tenantId.replace("-", "_");

        // Validate
        if (!schema.matches("tenant_[a-z0-9_]+")) {
            throw new IllegalArgumentException("Invalid tenant schema name: " + schema);
        }

        try (Connection conn = dataSource.getConnection()) {
            Statement stmt = conn.createStatement();

            // 1. Create schema
            stmt.execute("CREATE SCHEMA IF NOT EXISTS " + schema);

            // 2. Set search path to new schema
            stmt.execute("SET search_path TO " + schema);

            // 3. Run all tenant table migrations in this schema
            // Uses Flyway or Liquibase with tenant-specific schema
            runTenantMigrations(conn, schema);

            // 4. Create tenant_profile row
            stmt.execute("""
                INSERT INTO tenant_profile (tenant_id) VALUES ('%s')
            """.formatted(tenantId));

            log.info("Provisioned schema {} for tenant {}", schema, tenantId);

        } catch (SQLException e) {
            throw new RuntimeException("Failed to provision tenant schema: " + e.getMessage(), e);
        }
    }

    /**
     * Runs all tenant schema migrations using Flyway.
     * Migration scripts live in: db/migration/tenant/
     */
    private void runTenantMigrations(Connection conn, String schema) {
        Flyway flyway = Flyway.configure()
            .dataSource(dataSource)
            .schemas(schema)
            .locations("classpath:db/migration/tenant")
            .load();

        flyway.migrate();
    }

    /**
     * Called when a tenant is deactivated.
     * Does NOT drop the schema — data is retained for legal/audit reasons.
     * Just marks the tenant as inactive and revokes all user sessions.
     */
    public void deactivateTenant(String tenantId) {
        // Revoke all refresh tokens for all users in this tenant
        // Mark tenant_profile.is_active = false
        // Central platform marks tenant as inactive
        log.info("Tenant {} deactivated. Schema retained.", tenantId);
    }
}
```

---

## Part 8 — Permission Enforcement in Controllers

```java
// Example: Only ANALYST, CCO, and TENANT_ADMIN can record control tests
// VIEWER and AUDITOR cannot

@RestController
@RequestMapping("/api/v1/controls")
public class ControlController {

    // Any authenticated user can READ controls
    @GetMapping
    public ResponseEntity<List<ControlDto>> listControls() {
        return ResponseEntity.ok(controlService.findAll());
    }

    // Only ANALYST, CCO, TENANT_ADMIN can record test results
    @PostMapping("/{id}/tests")
    @PreAuthorize("hasAnyRole('ANALYST', 'CCO', 'TENANT_ADMIN')")
    public ResponseEntity<TestResultDto> recordTest(
        @PathVariable Long id,
        @Valid @RequestBody RecordTestRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(controlService.recordTest(id, req, currentUser));
    }

    // Only CCO and TENANT_ADMIN can approve test results
    @PostMapping("/{id}/tests/{testId}/approve")
    @PreAuthorize("hasAnyRole('CCO', 'TENANT_ADMIN')")
    public ResponseEntity<TestResultDto> approveTest(
        @PathVariable Long id,
        @PathVariable Long testId
    ) {
        return ResponseEntity.ok(controlService.approveTest(id, testId));
    }
}

// Example: Only CCO can close findings and generate board packs
@RestController
@RequestMapping("/api/v1/findings")
public class FindingController {

    @GetMapping
    public ResponseEntity<Page<FindingDto>> listFindings(Pageable pageable) {
        return ResponseEntity.ok(findingService.findAll(pageable));
    }

    @PutMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('CCO', 'TENANT_ADMIN')")
    public ResponseEntity<FindingDto> closeFinding(
        @PathVariable Long id,
        @Valid @RequestBody CloseFindingRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(findingService.close(id, req, currentUser));
    }
}
```

---

## Part 9 — Email Templates

### Invite Email

```
Subject: You've been invited to Atheris Compliance Platform

Hi {full_name},

{invited_by_name} has invited you to join {tenant_name}'s
compliance workspace on Atheris.

Your role: {role}

Click the button below to set your password and get started.
This link expires in 72 hours.

[ Accept Invite & Set Password ]
{invite_link}

If you did not expect this invite, you can safely ignore this email.

— The Atheris Team
```

### Password Reset Email

```
Subject: Reset your Atheris password

Hi {full_name},

We received a request to reset your Atheris password.

Click the button below to set a new password.
This link expires in 1 hour.

[ Reset My Password ]
{reset_link}

If you did not request this, your account is safe.
No changes have been made.

— The Atheris Team
```

---

## Part 10 — Full User Lifecycle Summary

```
1. TENANT_ADMIN invites user
   POST /api/v1/users/invite
   → User row created (no password)
   → invite_tokens row created (72h expiry)
   → Invite email sent

2. User receives email, clicks link
   GET /api/v1/auth/invite/validate?token=xxx
   → Token validated, returns name + email for UI

3. User sets password
   POST /api/v1/auth/invite/accept
   → Password hashed and saved
   → Token marked used
   → Access token + refresh token issued
   → User is now logged in

4. User logs in (subsequent visits)
   POST /api/v1/auth/login
   → Password verified
   → Access token (15 min) + refresh token (30 days) issued

5. Access token expires
   POST /api/v1/auth/refresh
   → Refresh token validated
   → New access token + rotated refresh token issued

6. User logs out
   POST /api/v1/auth/logout
   → Refresh token revoked
   → Next refresh attempt fails

7. User forgets password
   POST /api/v1/auth/password/reset-request
   → Reset email sent (1h expiry)
   POST /api/v1/auth/password/reset
   → New password set
   → All refresh tokens revoked (all sessions logged out)

8. Admin deactivates user
   PUT /api/v1/users/{id}/deactivate
   → is_active = false
   → All refresh tokens revoked
   → User's next request returns 401
```

---

## Folder Structure

```
modules/
├── auth/
│   ├── AuthService.java
│   ├── AuthController.java
│   ├── JwtService.java
│   ├── JwtAuthFilter.java
│   ├── TenantSchemaFilter.java
│   ├── TenantContextHolder.java
│   └── dto/
│       ├── LoginRequest.java
│       ├── AcceptInviteRequest.java
│       ├── ResetPasswordRequest.java
│       └── AuthTokens.java
│
├── users/
│   ├── User.java                   ← Entity
│   ├── UserRepository.java
│   ├── UserService.java
│   ├── UserController.java
│   └── dto/
│       ├── InviteUserRequest.java
│       └── UserDto.java
│
└── provisioning/
    └── TenantProvisioningService.java
```


---

## 7 — Onboarding, Subscriptions & Intelligence API

### 7.1 Tenant Onboarding & Subscription Management


## Overview

Onboarding is a 4-step wizard that collects everything needed to:
1. Identify the institution (licence type, products, state)
2. Route regulatory obligations to them correctly (regulator subscriptions)
3. Filter the obligations they care about (document types, risk ratings)
4. Provision their isolated tenant environment automatically

Post-onboarding, all of these choices are editable via REST endpoints.

---

## The 4-Step Onboarding Wizard

```
Step 1 — Institution Details
  Legal name, short name, licence type, licence number,
  state of HQ, employee count, product lines, CCO contact

Step 2 — Regulator Subscriptions
  Which of the 43 Nigerian regulators to subscribe to
  Notification frequency per regulator
  Recommended regulators pre-selected based on licence type

Step 3 — Document Type Preferences
  Which document types to track (Circulars, Acts, Guidelines, etc.)
  Risk rating notification filter

Step 4 — Review & Confirm
  Summary of all selections before submission
```

---

## Data Model

### `tenant_profile` (in tenant schema — already defined, extended here)

```sql
-- Add these columns to the existing tenant_profile table

ALTER TABLE tenant_profile ADD COLUMN
  subscribed_regulators TEXT[] NOT NULL DEFAULT '{}';
  -- e.g. ['CBN', 'NDIC', 'NDPC', 'NFIU']
  -- Drives which webhook obligations are sent to this tenant

ALTER TABLE tenant_profile ADD COLUMN
  subscribed_document_types TEXT[] NOT NULL DEFAULT '{}';
  -- e.g. ['Circular', 'Regulation', 'Act', 'Guideline', 'Directive']
  -- Filters which instrument types are pushed via webhook

ALTER TABLE tenant_profile ADD COLUMN
  notification_risk_ratings TEXT[] NOT NULL DEFAULT '{High,Medium}';
  -- e.g. ['High', 'Medium']
  -- Only obligations matching these risk ratings trigger immediate notifications
  -- Low-risk items still arrive but don't trigger email/dashboard alerts

ALTER TABLE tenant_profile ADD COLUMN
  notification_frequency VARCHAR(50) DEFAULT 'immediate';
  -- 'immediate' | 'daily_digest' | 'weekly_digest'
  -- How quickly new obligations are pushed after detection

ALTER TABLE tenant_profile ADD COLUMN
  onboarding_completed_at TIMESTAMP;
  -- NULL = onboarding not yet completed
  -- Set when Step 4 is confirmed

ALTER TABLE tenant_profile ADD COLUMN
  onboarding_step INT DEFAULT 1;
  -- Which step the tenant is on (for resuming incomplete onboarding)
```

### `tenant_regulator_preferences` (per-regulator overrides)

Some tenants want different notification settings per regulator. This table stores overrides.

```sql
CREATE TABLE tenant_regulator_preferences (
  preference_id   SERIAL PRIMARY KEY,
  
  -- Which regulator?
  regulator_id    INT NOT NULL,
  regulator_abbr  VARCHAR(20) NOT NULL,
  
  -- Subscription status
  is_subscribed   BOOLEAN NOT NULL DEFAULT true,
  
  -- Document type overrides for this specific regulator
  -- NULL = use tenant-level default from tenant_profile
  document_types_override TEXT[],
  
  -- Notification override for this regulator
  -- NULL = use tenant-level default
  notification_frequency_override VARCHAR(50),
  
  -- When was this preference last updated?
  updated_by_user_id INT REFERENCES users(user_id),
  updated_at      TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (regulator_id)
);
```

**Example rows:**

```
preference_id: 1
regulator_abbr: CBN
is_subscribed: true
document_types_override: NULL         -- use tenant default
notification_frequency_override: 'immediate'  -- CBN is critical, override to immediate

preference_id: 2
regulator_abbr: FCCPC
is_subscribed: true
document_types_override: ['Circular', 'Directive']  -- only these two from FCCPC
notification_frequency_override: 'daily_digest'     -- FCCPC not as urgent
```

---

## REST API — Onboarding

### Step 1: Save Institution Details (and resume onboarding)

```
POST /api/v1/onboarding/institution
     → Called at the end of Step 1
     → Creates tenant profile if first time, updates if resuming

Body:
{
  "legal_name": "Guaranty Trust Bank Plc",
  "short_name": "GTB",
  "licence_type": "Commercial Bank",
  "licence_number": "RC152772",
  "state_of_hq": "Lagos",
  "employee_count_range": "1001-5000",
  "product_lines": ["Retail Banking", "Corporate Banking", "Consumer Credit"],
  "cco_name": "Ngozi Eze",
  "cco_email": "ngozi.eze@gtb.com"
}

Response:
{
  "tenant_id": "uuid-gtb",
  "onboarding_step": 1,
  "next_step": 2,
  "recommended_regulators": ["CBN", "NDIC", "NFIU"]
}
```

The `recommended_regulators` in the response is computed server-side based on `licence_type`. The frontend uses this to pre-select the appropriate regulators in Step 2.

### Step 2: Save Regulator Subscriptions

```
POST /api/v1/onboarding/regulators
     → Called at the end of Step 2

Body:
{
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC"],
  "notification_frequency": "immediate",
  "per_regulator_overrides": [
    {
      "regulator_abbr": "CBN",
      "notification_frequency_override": "immediate"
    },
    {
      "regulator_abbr": "FCCPC",
      "notification_frequency_override": "daily_digest"
    }
  ]
}

Response:
{
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC"],
  "onboarding_step": 2,
  "next_step": 3
}
```

### Step 3: Save Document Type Preferences

```
POST /api/v1/onboarding/document-types
     → Called at the end of Step 3

Body:
{
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Guideline", "Directive"],
  "notification_risk_ratings": ["High", "Medium"]
}

Response:
{
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Guideline", "Directive"],
  "notification_risk_ratings": ["High", "Medium"],
  "onboarding_step": 3,
  "next_step": 4
}
```

### Step 4: Confirm and Complete Onboarding

```
POST /api/v1/onboarding/confirm
     → Called when tenant clicks "Complete setup" on Step 4
     → Finalises profile, provisions tenant schema, sends webhook test

Body:
{
  "webhook_url": "https://compliance.gtb.com/webhooks/atheris",
  "confirm": true
}

Response:
{
  "tenant_id": "uuid-gtb",
  "onboarding_completed_at": "2026-05-19T14:30:00Z",
  "webhook_secret": "whsec_xxxx",  ← Only shown ONCE. Tenant must save this.
  "api_key": "atk_xxxx",
  "webhook_test_result": {
    "delivered": true,
    "status_code": 200,
    "latency_ms": 143
  },
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC"],
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Guideline", "Directive"],
  "obligations_available": 47,   ← Matching obligations already in platform library
  "message": "Onboarding complete. Historical obligations are being pushed now."
}
```

### Resume Incomplete Onboarding

```
GET /api/v1/onboarding/status
    → Returns current onboarding state so the UI can resume
    → Called when user revisits the onboarding wizard mid-flow

Response:
{
  "onboarding_completed": false,
  "current_step": 2,
  "institution": {
    "legal_name": "Guaranty Trust Bank Plc",
    "licence_type": "Commercial Bank",
    "product_lines": ["Retail Banking", "Corporate Banking"]
  },
  "subscribed_regulators": [],   ← Not yet saved (user is on step 2)
  "subscribed_document_types": []
}
```

---

## OnboardingController.java

```java
@RestController
@RequestMapping("/api/v1/onboarding")
@RequiresAuthentication
@Slf4j
public class OnboardingController {

    @Autowired private OnboardingService onboardingService;
    @Autowired private RegulatorRecommendationService regRecommender;
    @Autowired private TenantProvisioningService provisioning;
    @Autowired private WebhookService webhooks;
    @Autowired private AuditService audit;

    // ─────────────────────────────────────────────────────────────────
    // STEP 1 — INSTITUTION DETAILS
    // ─────────────────────────────────────────────────────────────────

    @PostMapping("/institution")
    public ResponseEntity<InstitutionStepResponse> saveInstitution(
        @Valid @RequestBody InstitutionDetailsRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        // Save to tenant_profile
        onboardingService.saveInstitution(req);

        // Compute recommended regulators based on licence type
        List<String> recommended = regRecommender.recommend(req.getLicenceType());

        audit.log(currentUser.getUserId(), "onboarding_step1_saved",
            "tenant_profile", null, Map.of("licence_type", req.getLicenceType()));

        return ResponseEntity.ok(InstitutionStepResponse.builder()
            .onboardingStep(1)
            .nextStep(2)
            .recommendedRegulators(recommended)
            .build()
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 2 — REGULATOR SUBSCRIPTIONS
    // ─────────────────────────────────────────────────────────────────

    @PostMapping("/regulators")
    public ResponseEntity<RegulatorStepResponse> saveRegulators(
        @Valid @RequestBody RegulatorSubscriptionRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        // Validate all regulator abbrs exist in central platform
        onboardingService.validateRegulators(req.getSubscribedRegulators());

        // Save subscriptions + per-regulator overrides
        onboardingService.saveRegulatorSubscriptions(
            req.getSubscribedRegulators(),
            req.getNotificationFrequency(),
            req.getPerRegulatorOverrides()
        );

        audit.log(currentUser.getUserId(), "onboarding_step2_saved",
            "tenant_profile", null,
            Map.of("regulators", req.getSubscribedRegulators()));

        return ResponseEntity.ok(RegulatorStepResponse.builder()
            .subscribedRegulators(req.getSubscribedRegulators())
            .onboardingStep(2)
            .nextStep(3)
            .build()
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 3 — DOCUMENT TYPE PREFERENCES
    // ─────────────────────────────────────────────────────────────────

    @PostMapping("/document-types")
    public ResponseEntity<DocumentTypeStepResponse> saveDocumentTypes(
        @Valid @RequestBody DocumentTypeRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        onboardingService.saveDocumentTypePreferences(
            req.getSubscribedDocumentTypes(),
            req.getNotificationRiskRatings()
        );

        audit.log(currentUser.getUserId(), "onboarding_step3_saved",
            "tenant_profile", null,
            Map.of("doc_types", req.getSubscribedDocumentTypes()));

        return ResponseEntity.ok(DocumentTypeStepResponse.builder()
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes())
            .notificationRiskRatings(req.getNotificationRiskRatings())
            .onboardingStep(3)
            .nextStep(4)
            .build()
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 4 — CONFIRM
    // ─────────────────────────────────────────────────────────────────

    @PostMapping("/confirm")
    @Transactional
    public ResponseEntity<OnboardingCompleteResponse> confirm(
        @Valid @RequestBody OnboardingConfirmRequest req,
        @AuthenticationPrincipal User currentUser
    ) {
        // 1. Save webhook URL
        onboardingService.saveWebhookUrl(req.getWebhookUrl());

        // 2. Mark onboarding complete
        onboardingService.markComplete();

        // 3. Notify central platform — push all matching existing obligations
        // (obligations already classified that match this tenant's subscriptions)
        int existingObligations = onboardingService.requestHistoricalPush();

        // 4. Test webhook
        WebhookTestResult testResult = webhooks.sendTestPing(req.getWebhookUrl());

        // 5. Retrieve the generated API key and webhook secret
        String webhookSecret = onboardingService.getWebhookSecret();
        String apiKey = onboardingService.getApiKey();

        audit.log(currentUser.getUserId(), "onboarding_completed",
            "tenant_profile", null, Map.of());

        log.info("Tenant onboarding completed.");

        return ResponseEntity.ok(OnboardingCompleteResponse.builder()
            .onboardingCompletedAt(Instant.now())
            .webhookSecret(webhookSecret)   // Shown ONCE only
            .apiKey(apiKey)
            .webhookTestResult(testResult)
            .obligationsAvailable(existingObligations)
            .message("Onboarding complete. Historical obligations are being pushed now.")
            .build()
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // RESUME STATUS
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<OnboardingStatusResponse> getStatus() {
        return ResponseEntity.ok(onboardingService.getStatus());
    }
}
```

---

## RegulatorRecommendationService.java

```java
@Service
public class RegulatorRecommendationService {

    // Maps licence type → list of recommended regulator abbreviations
    private static final Map<String, List<String>> RECOMMENDATIONS = Map.of(
        "Commercial Bank",          List.of("CBN", "NDIC", "NFIU", "NDPC"),
        "Merchant Bank",            List.of("CBN", "NDIC", "NFIU", "NDPC"),
        "Microfinance Bank",        List.of("CBN", "NDIC", "NFIU"),
        "Fintech / Payment Service Provider", List.of("CBN", "NFIU", "NDPC", "FCCPC"),
        "Pension Fund Administrator", List.of("PenCom", "NDPC", "FIRS"),
        "Insurance Company",        List.of("NAICOM", "NDPC", "FIRS"),
        "Capital Market Dealer",    List.of("SEC", "NDPC", "CAC"),
        "Investment Adviser",       List.of("SEC", "NDPC"),
        "Bureau de Change",         List.of("CBN", "NFIU", "EFCC")
    );

    public List<String> recommend(String licenceType) {
        return RECOMMENDATIONS.getOrDefault(licenceType, List.of("CBN", "NDPC"));
    }
}
```

---

## POST-ONBOARDING SUBSCRIPTION MANAGEMENT

All subscriptions are modifiable after onboarding. These endpoints are available to `TENANT_ADMIN` and `CCO` roles.

---

### View Current Subscriptions

```
GET /api/v1/subscriptions
    → Full current subscription profile

Response:
{
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC"],
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Guideline", "Directive"],
  "notification_risk_ratings": ["High", "Medium"],
  "notification_frequency": "immediate",
  "per_regulator_overrides": [
    {
      "regulator_abbr": "CBN",
      "is_subscribed": true,
      "notification_frequency_override": "immediate",
      "document_types_override": null
    },
    {
      "regulator_abbr": "FCCPC",
      "is_subscribed": true,
      "notification_frequency_override": "daily_digest",
      "document_types_override": ["Circular", "Directive"]
    }
  ],
  "last_updated_at": "2026-05-19T14:30:00Z"
}
```

---

### Update Regulator Subscriptions

```
PUT /api/v1/subscriptions/regulators
    → Add or remove regulator subscriptions in bulk
    Roles: TENANT_ADMIN, CCO

Body:
{
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC", "SEC"]
}

Response:
{
  "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC", "FCCPC", "SEC"],
  "added": ["SEC"],
  "removed": [],
  "message": "Subscriptions updated. You will now receive SEC obligations."
}
```

**Side effects:**
- If a new regulator is added, the system immediately queries the central platform for existing published obligations from that regulator and pushes them via webhook.
- If a regulator is removed, no new obligations from that regulator will be sent. Existing received obligations are not deleted.

---

### Add a Single Regulator

```
POST /api/v1/subscriptions/regulators/{abbr}
     → Subscribe to one regulator
     e.g. POST /api/v1/subscriptions/regulators/SEC

Response:
{
  "regulator_abbr": "SEC",
  "subscribed": true,
  "existing_obligations_queued": 23,
  "message": "Subscribed to SEC. 23 existing obligations are being pushed now."
}
```

---

### Remove a Single Regulator

```
DELETE /api/v1/subscriptions/regulators/{abbr}
       → Unsubscribe from one regulator
       e.g. DELETE /api/v1/subscriptions/regulators/FCCPC

Response:
{
  "regulator_abbr": "FCCPC",
  "subscribed": false,
  "message": "Unsubscribed from FCCPC. No new FCCPC obligations will be sent."
}
```

---

### Update Per-Regulator Preferences

```
PUT /api/v1/subscriptions/regulators/{abbr}/preferences
    → Override document types or notification frequency for one specific regulator
    e.g. PUT /api/v1/subscriptions/regulators/CBN/preferences

Body:
{
  "notification_frequency_override": "immediate",
  "document_types_override": ["Circular", "Directive", "Act"]
}

Response:
{
  "regulator_abbr": "CBN",
  "notification_frequency_override": "immediate",
  "document_types_override": ["Circular", "Directive", "Act"],
  "updated_at": "2026-05-19T15:00:00Z"
}
```

---

### Reset Per-Regulator Preferences to Default

```
DELETE /api/v1/subscriptions/regulators/{abbr}/preferences
       → Clears overrides, falls back to tenant-level defaults
       e.g. DELETE /api/v1/subscriptions/regulators/CBN/preferences

Response:
{
  "regulator_abbr": "CBN",
  "overrides_cleared": true,
  "now_using": "tenant_defaults"
}
```

---

### Update Document Type Preferences

```
PUT /api/v1/subscriptions/document-types
    → Change which document types are tracked globally

Body:
{
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Directive"],
  "notification_risk_ratings": ["High"]
}

Response:
{
  "subscribed_document_types": ["Circular", "Act", "Regulation", "Directive"],
  "notification_risk_ratings": ["High"],
  "updated_at": "2026-05-19T15:00:00Z"
}
```

---

### Update Notification Frequency

```
PUT /api/v1/subscriptions/notifications
    → Change global notification frequency

Body:
{
  "notification_frequency": "daily_digest"
}

Response:
{
  "notification_frequency": "daily_digest",
  "updated_at": "2026-05-19T15:00:00Z"
}
```

---

### List Available Regulators (from Central Platform)

```
GET /api/v1/subscriptions/regulators/available
    → Returns all 43 regulators available on the platform
    → Includes whether the tenant is currently subscribed to each
    → Used to populate the subscription management UI

Response:
{
  "regulators": [
    {
      "regulator_id": 1,
      "name": "Central Bank of Nigeria",
      "abbreviation": "CBN",
      "description": "Primary regulator for banks and financial institutions",
      "is_subscribed": true,
      "obligation_count": 215,        ← How many obligations exist for this regulator
      "last_document_at": "2026-05-28"  ← When was the last doc from this regulator
    },
    {
      "regulator_id": 2,
      "name": "Securities and Exchange Commission",
      "abbreviation": "SEC",
      "is_subscribed": false,
      "obligation_count": 87,
      "last_document_at": "2026-05-10"
    }
    ...
  ]
}
```

---

### List Available Document Types

```
GET /api/v1/subscriptions/document-types/available
    → Returns all document types the platform supports
    → Used to populate the document type management UI

Response:
{
  "document_types": [
    { "name": "Circular",          "subscribed": true,  "count": 180 },
    { "name": "Act",               "subscribed": true,  "count": 45 },
    { "name": "Regulation",        "subscribed": true,  "count": 38 },
    { "name": "Guideline",         "subscribed": true,  "count": 72 },
    { "name": "Directive",         "subscribed": true,  "count": 29 },
    { "name": "Exposure Draft",    "subscribed": false, "count": 12 },
    { "name": "Consultative Paper","subscribed": false, "count": 8  },
    { "name": "Notice",            "subscribed": false, "count": 31 },
    { "name": "Code of Conduct",   "subscribed": false, "count": 6  }
  ]
}
```

---

## SubscriptionService.java

```java
@Service
@Slf4j
public class SubscriptionService {

    @Autowired private TenantProfileRepository profile;
    @Autowired private TenantRegulatorPreferenceRepository regPrefs;
    @Autowired private PlatformApiClient platformApi;
    @Autowired private WebhookService webhooks;
    @Autowired private AuditService audit;

    // ─────────────────────────────────────────────────────────────────
    // ADD A REGULATOR SUBSCRIPTION
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public AddRegulatorResult addRegulator(String regulatorAbbr, Integer userId) {

        // 1. Validate regulator exists on central platform
        if (!platformApi.regulatorExists(regulatorAbbr)) {
            throw new NotFoundException("Regulator not found: " + regulatorAbbr);
        }

        // 2. Update subscribed_regulators array
        profile.addSubscribedRegulator(regulatorAbbr);

        // 3. Create preference row if not exists
        if (!regPrefs.existsByAbbr(regulatorAbbr)) {
            regPrefs.insert(TenantRegulatorPreference.builder()
                .regulatorAbbr(regulatorAbbr)
                .isSubscribed(true)
                .build()
            );
        } else {
            regPrefs.setSubscribed(regulatorAbbr, true);
        }

        // 4. Request historical push from central platform
        // The platform will push all existing published obligations
        // from this regulator that match the tenant's other filters
        int existingCount = platformApi.requestHistoricalPushForRegulator(regulatorAbbr);

        // 5. Audit log
        audit.log(userId, "regulator_added", "subscription", null,
            Map.of("regulator", regulatorAbbr));

        log.info("Tenant subscribed to {}. {} historical obligations queued.", 
            regulatorAbbr, existingCount);

        return AddRegulatorResult.builder()
            .regulatorAbbr(regulatorAbbr)
            .subscribed(true)
            .existingObligationsQueued(existingCount)
            .build();
    }

    // ─────────────────────────────────────────────────────────────────
    // REMOVE A REGULATOR SUBSCRIPTION
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public void removeRegulator(String regulatorAbbr, Integer userId) {
        profile.removeSubscribedRegulator(regulatorAbbr);
        regPrefs.setSubscribed(regulatorAbbr, false);

        // Existing received_obligations from this regulator are NOT deleted
        // They are already in the tenant's compliance register
        // The tenant must handle them — they cannot be auto-removed

        audit.log(userId, "regulator_removed", "subscription", null,
            Map.of("regulator", regulatorAbbr));

        log.info("Tenant unsubscribed from {}.", regulatorAbbr);
    }

    // ─────────────────────────────────────────────────────────────────
    // UPDATE DOCUMENT TYPE PREFERENCES
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public void updateDocumentTypes(List<String> docTypes,
                                    List<String> riskRatings, Integer userId) {
        profile.updateDocumentTypes(docTypes, riskRatings);

        audit.log(userId, "document_types_updated", "subscription", null,
            Map.of("doc_types", docTypes, "risk_ratings", riskRatings));
    }

    // ─────────────────────────────────────────────────────────────────
    // UPDATE PER-REGULATOR PREFERENCES
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public void updateRegulatorPreferences(String regulatorAbbr,
                                           String freqOverride,
                                           List<String> docTypesOverride,
                                           Integer userId) {
        regPrefs.updatePreferences(regulatorAbbr, freqOverride, docTypesOverride);

        audit.log(userId, "regulator_preferences_updated", "subscription", null,
            Map.of("regulator", regulatorAbbr,
                   "freq_override", freqOverride != null ? freqOverride : "cleared",
                   "doc_types_override", docTypesOverride != null ? docTypesOverride : List.of()));
    }
}
```

---

## How Subscriptions Filter Webhook Delivery (Central Platform Side)

When the central platform is about to send a webhook to a tenant, it checks ALL of these conditions:

```java
// In WebhookRouterService.java (central platform)

private boolean shouldDeliverToTenant(Instrument instrument, Tenant tenant) {

    // 1. Is tenant active?
    if (!tenant.isActive()) return false;

    // 2. Is this regulator in the tenant's subscribed_regulators?
    if (!tenant.getSubscribedRegulators().contains(instrument.getRegulatorAbbr())) {
        return false;
    }

    // 3. Is this document type in the tenant's subscribed_document_types?
    if (!tenant.getSubscribedDocumentTypes().contains(instrument.getInstrumentType())) {
        return false;
    }

    // 4. Does this instrument's licence_types_applicable match the tenant?
    if (!licenceTypeMatches(instrument.getLicenceTypesApplicable(), tenant.getLicenceType())) {
        return false;
    }

    // 5. Check per-regulator override: has the tenant disabled this regulator?
    TenantRegulatorPreference pref = tenant.getRegulatorPreference(instrument.getRegulatorAbbr());
    if (pref != null && !pref.isSubscribed()) {
        return false;
    }

    // 6. If per-regulator doc type override exists, check that too
    if (pref != null && pref.getDocumentTypesOverride() != null) {
        if (!pref.getDocumentTypesOverride().contains(instrument.getInstrumentType())) {
            return false;
        }
    }

    return true;
}
```

---

## Complete API Summary

### Onboarding (wizard flow)

```
GET    /api/v1/onboarding/status                     → Resume onboarding status
POST   /api/v1/onboarding/institution                → Save step 1
POST   /api/v1/onboarding/regulators                 → Save step 2
POST   /api/v1/onboarding/document-types             → Save step 3
POST   /api/v1/onboarding/confirm                    → Complete onboarding
```

### Post-Onboarding Subscription Management

```
GET    /api/v1/subscriptions                                      → View all subscriptions
GET    /api/v1/subscriptions/regulators/available                 → All available regulators
GET    /api/v1/subscriptions/document-types/available             → All available doc types
PUT    /api/v1/subscriptions/regulators                           → Update regulator list (bulk)
POST   /api/v1/subscriptions/regulators/{abbr}                    → Subscribe to one regulator
DELETE /api/v1/subscriptions/regulators/{abbr}                    → Unsubscribe from regulator
GET    /api/v1/subscriptions/regulators/{abbr}/preferences        → Get per-regulator prefs
PUT    /api/v1/subscriptions/regulators/{abbr}/preferences        → Update per-regulator prefs
DELETE /api/v1/subscriptions/regulators/{abbr}/preferences        → Reset to tenant defaults
PUT    /api/v1/subscriptions/document-types                       → Update doc type prefs
PUT    /api/v1/subscriptions/notifications                        → Update notification frequency
```

---

## Folder Structure (New Modules)

```
modules/
├── onboarding/
│   ├── OnboardingController.java
│   ├── OnboardingService.java
│   ├── RegulatorRecommendationService.java
│   └── dto/
│       ├── InstitutionDetailsRequest.java
│       ├── RegulatorSubscriptionRequest.java
│       ├── DocumentTypeRequest.java
│       ├── OnboardingConfirmRequest.java
│       └── OnboardingCompleteResponse.java
│
└── subscriptions/
    ├── SubscriptionController.java
    ├── SubscriptionService.java
    ├── TenantRegulatorPreference.java      ← Entity
    ├── TenantRegulatorPreferenceRepository.java
    └── dto/
        ├── SubscriptionSummaryDto.java
        ├── AddRegulatorResult.java
        └── RegulatorPreferenceDto.java
```


### 7.2 Regulatory Intelligence API (Standalone Product)


## What This Is

The Regulatory Intelligence API is Product 1 — a standalone product that delivers structured Nigerian regulatory intelligence to any system that can receive a webhook or make a REST call. It does not require the full Atheris tenant application.

A bank with an existing GRC tool (SAP, MetricStream, in-house) subscribes to this API and receives:
- Structured obligation data when new regulations are published
- Applicability filtering based on their licence type and regulator subscriptions
- Access to the full historical obligation library via REST

---

## The Immutability Principle

This is the core of why the API scales cheaply:

```
CBN publishes a circular
        ↓
Atheris downloads the PDF ONCE
        ↓
OCR extracts the text ONCE → same bytes regardless of recipient
        ↓
AI classifies it ONCE → same risk_rating, obligations, sanctions for everyone
        ↓
Stored once in instruments table as instrument_id: 4821
        ↓
GTB receives webhook    → { obligation_id: 4821, ... }
Access Bank receives it → { obligation_id: 4821, ... }
Cowrywise receives it   → { obligation_id: 4821, ... }
ARM Pensions receives   → { obligation_id: 4821, ... }
```

The regulatory content is public law. It is the same for every Nigerian institution. The text of a CBN circular does not change depending on who reads it. The AI classification does not change. The sanctions do not change.

What changes per institution:
- Does it apply to them? (based on their licence type)
- Which regulators have they subscribed to?
- Which document types do they want?

Those three filters are applied at delivery time. The underlying data is shared and immutable.

**Cost implication:** Classifying one document costs one Claude API call regardless of how many tenants receive it. 500 tenants costs the same as 5 for the intelligence work. Only webhook delivery scales with tenant count — and that is cheap.

---

## API Authentication

All API calls require an API key issued at onboarding:

```
Authorization: Bearer atk_xxxx
```

Webhooks are signed with HMAC-SHA256:

```
X-Atheris-Signature: sha256={HMAC_SHA256(body, webhook_secret)}
X-Webhook-Event-ID: webhook_20260531_001
X-Webhook-Timestamp: 2026-05-31T02:31:00Z
```

---

## REST API

### Obligations

```
GET /api/v1/intelligence/obligations
    → Query the obligation library
    → Returns only obligations matching the tenant's subscriptions

    Query params:
      ?regulator=CBN              → Filter by regulator
      ?theme=AML                  → Filter by compliance theme
      ?risk_rating=High           → Filter by risk rating (High/Medium/Low)
      ?instrument_type=Circular   → Filter by document type
      ?since=2026-01-01           → New or updated since date
      ?page=1&page_size=50        → Pagination

    Response:
    {
      "total": 47,
      "page": 1,
      "page_size": 50,
      "obligations": [
        {
          "obligation_id": 4821,
          "regulator": "CBN",
          "instrument_type": "Circular",
          "title": "Re: Guidelines on ATM Cash Disbursement Operations",
          "area_of_focus": "Cash Management",
          "theme": "Cash Management",
          "nature": "Core",
          "risk_rating": "High",
          "date_issued": "2026-05-28",
          "date_commencement": "2026-07-01",
          "ai_summary": "Banks must ensure all ATMs are funded within 24 hours of cash depletion. Branches with 3+ consecutive failures face ₦1m/branch fine.",
          "specific_obligations": [
            {
              "number": 1,
              "statement": "All ATMs must be funded within 24 hours of cash depletion",
              "section_reference": "Section 4.1",
              "type": "Operational",
              "recurring": "Continuous"
            },
            {
              "number": 2,
              "statement": "Banks must report ATM downtime exceeding 48 hours to CBN",
              "section_reference": "Section 5.2",
              "type": "Reporting",
              "recurring": "As needed"
            }
          ],
          "sanctions": [
            {
              "type": "Fine per branch",
              "amount_naira": 1000000,
              "liable_roles": ["MD", "Head Operations", "CCO"],
              "severity": "High",
              "recently_enforced": true
            }
          ],
          "licence_types_applicable": ["Commercial Bank", "Merchant Bank"],
          "pdf_url": "https://platform.atheris.com/docs/4821.pdf",
          "published_at": "2026-05-28",
          "discovered_at": "2026-05-31T02:14:22Z"
        }
      ]
    }

GET /api/v1/intelligence/obligations/{id}
    → Full detail for one obligation including all sanctions and obligations

GET /api/v1/intelligence/obligations/{id}/pdf
    → Redirect to the original PDF (S3 signed URL, 1h expiry)
```

### Regulators

```
GET /api/v1/intelligence/regulators
    → All regulators available on the platform
    → Indicates which ones the tenant is subscribed to

    Response:
    {
      "regulators": [
        {
          "regulator_id": 1,
          "name": "Central Bank of Nigeria",
          "abbreviation": "CBN",
          "obligation_count": 215,
          "last_published_at": "2026-05-28",
          "is_subscribed": true
        },
        {
          "regulator_id": 2,
          "name": "Securities and Exchange Commission",
          "abbreviation": "SEC",
          "obligation_count": 87,
          "last_published_at": "2026-05-10",
          "is_subscribed": false
        }
      ]
    }
```

### Subscription Management

```
GET    /api/v1/intelligence/subscriptions
       → View current subscription config

PUT    /api/v1/intelligence/subscriptions/regulators
       → Update regulator subscriptions
       Body: { "subscribed_regulators": ["CBN", "NDIC", "NFIU", "NDPC"] }

PUT    /api/v1/intelligence/subscriptions/document-types
       → Update document type filter
       Body: { "subscribed_document_types": ["Circular", "Act", "Directive"] }

PUT    /api/v1/intelligence/subscriptions/notifications
       → Update notification preferences
       Body: {
         "notification_frequency": "immediate",
         "notification_risk_ratings": ["High", "Medium"]
       }

POST   /api/v1/intelligence/subscriptions/regulators/{abbr}
       → Add one regulator
       → Triggers historical push of existing obligations from that regulator

DELETE /api/v1/intelligence/subscriptions/regulators/{abbr}
       → Remove one regulator
```

### Webhook Management

```
PUT    /api/v1/intelligence/webhook
       → Update webhook endpoint URL
       Body: { "webhook_url": "https://grc.bank.com/webhooks/atheris" }

POST   /api/v1/intelligence/webhook/test
       → Send a test ping to the configured webhook endpoint
       Response: { "delivered": true, "status_code": 200, "latency_ms": 143 }

POST   /api/v1/intelligence/webhook/rotate-secret
       → Generate a new HMAC signing secret
       Response: { "webhook_secret": "whsec_xxxx" }  ← Shown once

GET    /api/v1/intelligence/webhook/deliveries
       → Last 100 webhook delivery attempts
       Query: ?status=failed  → Only failed deliveries
```

### Historical Backfill

```
POST   /api/v1/intelligence/backfill
       → Request a full historical push of all published obligations
       → Useful when first onboarding or after adding new regulator subscriptions
       → Jobs queued as LOW priority (does not block monitoring pipeline)
       Body: { "since": "2024-01-01" }  ← Optional: only obligations after this date

       Response:
       {
         "job_id": "backfill_20260519_001",
         "obligations_queued": 215,
         "estimated_delivery_minutes": 12,
         "message": "Backfill started. Obligations will be delivered via webhook."
       }

GET    /api/v1/intelligence/backfill/{job_id}
       → Check backfill progress
       Response: {
         "job_id": "backfill_20260519_001",
         "status": "running",
         "delivered": 143,
         "total": 215,
         "percent_complete": 67
       }
```

---

## Webhook Payload (Delivered to Consumer)

### `obligation.received`

Sent when a new obligation is published and matches the tenant's subscriptions.

```json
{
  "webhook_type": "obligation.received",
  "webhook_id": "webhook_20260531_001",
  "timestamp": "2026-05-31T02:31:00Z",

  "obligation": {
    "obligation_id": 4821,
    "regulator": "Central Bank of Nigeria",
    "regulator_abbreviation": "CBN",
    "instrument_type": "Circular",
    "title": "Re: Guidelines on ATM Cash Disbursement Operations",
    "area_of_focus": "Cash Management",
    "theme": "Cash Management",
    "nature": "Core",
    "risk_rating": "High",

    "date_issued": "2026-05-28",
    "date_commencement": "2026-07-01",
    "compliance_deadline_days": 31,

    "ai_summary": "Banks must ensure all ATMs are funded within 24 hours of cash depletion. Branches with 3+ consecutive failures face ₦1m/branch fine. Effective 1 July 2026.",

    "specific_obligations": [
      {
        "number": 1,
        "statement": "All ATMs must be funded within 24 hours of cash depletion",
        "section_reference": "Section 4.1",
        "type": "Operational",
        "recurring": "Continuous"
      },
      {
        "number": 2,
        "statement": "Banks must report ATM downtime exceeding 48 hours to CBN",
        "section_reference": "Section 5.2",
        "type": "Reporting",
        "recurring": "As needed"
      }
    ],

    "sanctions": [
      {
        "type": "Fine per branch",
        "amount_naira": 1000000,
        "per_incident": true,
        "liable_roles": ["MD", "Head Operations", "CCO"],
        "severity_score": 8,
        "recently_enforced": true,
        "last_enforcement_date": "2025-11-15"
      }
    ],

    "licence_types_applicable": ["Commercial Bank", "Merchant Bank"],
    "applicability_confidence": 0.97,

    "pdf_url": "https://platform.atheris.com/docs/4821.pdf",
    "source_url": "https://cbn.gov.ng/Out/Circulars/2026/May/ATM-2026.pdf",
    "published_at": "2026-05-28",
    "discovered_at": "2026-05-31T02:14:22Z"
  }
}
```

### `obligation.applicability_updated`

Sent when the platform re-evaluates applicability — e.g. ISA 2025 implementation rules drop.

```json
{
  "webhook_type": "obligation.applicability_updated",
  "webhook_id": "webhook_20260815_042",
  "timestamp": "2026-08-15T08:30:00Z",
  "obligation_id": 5102,
  "changes": {
    "status": {
      "old": "Draft",
      "new": "Published",
      "reason": "SEC clarified ISA 2025 implementation rules on 2026-08-15"
    },
    "applicability_confidence": { "old": 0.40, "new": 0.92 },
    "licence_types_applicable": {
      "old": null,
      "new": ["Capital Market Dealer", "Investment Adviser"]
    }
  },
  "action_required": true,
  "action_description": "Applicability now confirmed. Please update your compliance records."
}
```

### `obligation.superseded`

Sent when a regulation is repealed or replaced.

```json
{
  "webhook_type": "obligation.superseded",
  "webhook_id": "webhook_20260920_107",
  "timestamp": "2026-09-20T11:15:00Z",
  "obligation_id": 3847,
  "superseded_by_obligation_id": 4821,
  "reason": "CBN/2024/Old withdrawn. Replaced by CBN/2026/New (instrument_id: 4821).",
  "action_required": false,
  "action_description": "You may retire any controls linked solely to this obligation."
}
```

---

## How the Consumer Uses This

A bank with SAP GRC receives the `obligation.received` webhook and:

```python
# Example: bank's own webhook handler
@app.post('/webhooks/atheris')
def receive_obligation(request):
    # 1. Verify HMAC signature
    verify_hmac(request.headers['X-Atheris-Signature'], request.body)

    payload = request.json()
    obligation = payload['obligation']

    # 2. Map to their internal schema
    internal_record = {
        'external_id':   obligation['obligation_id'],
        'source':        'Atheris',
        'regulator':     obligation['regulator_abbreviation'],
        'title':         obligation['title'],
        'risk':          obligation['risk_rating'],
        'effective_date': obligation['date_commencement'],
        'summary':       obligation['ai_summary'],
        'penalty':       obligation['sanctions'][0]['amount_naira']
    }

    # 3. Create record in their own GRC system
    grc_client.create_regulatory_change(internal_record)

    # 4. Trigger their own workflow (assign owner, classify, etc.)
    workflow_engine.trigger('new_regulatory_obligation', internal_record)

    return 200
```

The bank does not need to scrape CBN. They do not need to run OCR. They do not need AI. They receive a structured, classified, actionable record — and plug it straight into their existing workflow.

---

## Applicability Filtering at Delivery

Before sending any webhook, the platform applies these checks:

```java
private boolean shouldDeliver(Instrument instrument, Tenant tenant) {

    // 1. Is tenant active and webhook configured?
    if (!tenant.isActive() || tenant.getWebhookUrl() == null) return false;

    // 2. Is this regulator in their subscriptions?
    if (!tenant.getSubscribedRegulators().contains(instrument.getRegulatorAbbr()))
        return false;

    // 3. Is this document type in their subscriptions?
    if (!tenant.getSubscribedDocumentTypes().contains(instrument.getInstrumentType()))
        return false;

    // 4. Does the licence type match?
    List<String> applicable = instrument.getLicenceTypesApplicable();
    if (applicable != null && !applicable.isEmpty())
        if (!applicable.contains(tenant.getLicenceType())) return false;

    // 5. Per-regulator override: has the tenant disabled this regulator?
    TenantRegulatorPreference pref =
        tenant.getRegulatorPreference(instrument.getRegulatorAbbr());
    if (pref != null && !pref.isSubscribed()) return false;

    // 6. Per-regulator doc type override?
    if (pref != null && pref.getDocumentTypesOverride() != null)
        if (!pref.getDocumentTypesOverride().contains(instrument.getInstrumentType()))
            return false;

    return true;
}
```

A Pension Fund Administrator subscribed to only PenCom and NDPC will never receive a CBN ATM circular. A Fintech subscribed to CBN but only for Circulars will never receive an Exposure Draft. The filtering is precise and runs entirely at the platform layer — the consumer never needs to filter on their side.

---

## Pricing Model

Two options depending on business model:

### Option A — Per-regulator subscription
```
Starter  → Up to 5 regulators          ₦150,000/month
Pro      → Up to 15 regulators         ₦350,000/month
Full     → All 43 regulators           ₦600,000/month
```

### Option B — Consumption-based
```
Per webhook delivered                  ₦500/webhook
Historical backfill (one-time)         ₦25,000/regulator
```

Option B works well for institutions that only need a few regulators and low volume. Option A works for Tier-1 banks with broad exposure.

---

## Folder Structure (New Additions to Central Platform)

```
modules/
└── intelligence-api/
    ├── IntelligenceController.java       ← All /api/v1/intelligence/* endpoints
    ├── IntelligenceSubscriptionService.java
    ├── WebhookManagementController.java
    └── dto/
        ├── ObligationApiDto.java         ← API response shape
        ├── WebhookPayloadBuilder.java    ← Builds webhook JSON
        └── BackfillRequest.java
```

---

## Summary

| | Product 1 (Intelligence API) | Product 2 (Full Platform) |
|---|---|---|
| Who it's for | Institutions with own GRC | Institutions with no solution |
| What they get | Webhooks + REST API | Intelligence + full workflow |
| What they build | Their own workflow on top | Nothing — it's all there |
| Pricing | Per regulator / per webhook | Per user / per institution |
| Onboarding | API key + webhook URL | 4-step wizard |
| Data they own | Their own GRC records | Their tenant schema |
| Central platform work | Same for both products | Same for both products |

The central intelligence platform does the same work regardless of which product the consumer uses. Classify once, serve everywhere.



---

## 8 — Central Platform UI, Obligation Inbox & Change Notifications

## Why the Central Platform Needs a UI

The webhook-only model has three gaps:

1. **Client system was down** when the webhook fired — they missed it
2. **Client has no webhook endpoint yet** — they need to browse manually
3. **Client wants to search** — "show me all CBN AML obligations from 2024 that are High risk"

The central platform UI solves all three. It is the entry point for both products.

---

## The Two Modules (Corrected Boundary)

```
CENTRAL PLATFORM UI

  Module 1 — Obligation Browser & Inbox
    ├── Search, filter, export the full obligation library
    ├── View full detail: AI summary, duties, sanctions, PDF
    ├── Obligation inbox — received, pending a decision
    ├── Mark applicable / not applicable  ← ONLY classification action here
    └── Subscription management (regulators, doc types, frequency)

  Module 2 — Change Notification System
    ├── Marking applicable creates a watch on that obligation
    ├── Central platform tracks all watchers per obligation
    ├── On any change → notify all watchers
    ├── Channels: in-app + email + webhook event
    └── Diff view: what changed, what your current decision was

TENANT APP (next session — not part of central platform)
    ├── Assign owner
    ├── Link controls (CRMP)
    ├── Set internal risk rating + justification
    ├── Gap management
    └── Testing, findings, returns, dashboard
```

### Why This Boundary

**Mark applicable / not applicable** lives on the central platform because:
- It is the trigger that creates the watch — "I care about this, notify me if it changes"
- A Product 1 client (Intelligence API only, no full tenant app) still needs this
- It requires zero knowledge of internal controls or org structure
- It answers: *"does this apply to us?"* — a one-click decision

**Everything deeper** lives in the tenant app because:
- Assigning an owner requires the bank's org chart and named users
- Linking controls requires the CRMP to exist first
- Internal risk rating requires context about the bank's specific exposure
- These answer: *"what do we do about it?"* — which is tenant-specific

---

## Part 1 — Data Model

### `obligation_watches` (Central Platform)

When a tenant classifies an obligation (marks it applicable or not), the central platform records that they are "watching" it. This is what drives change notifications.

```sql
CREATE TABLE obligation_watches (
  watch_id          BIGINT PRIMARY KEY,
  instrument_id     BIGINT NOT NULL REFERENCES instruments(instrument_id),
  tenant_id         UUID NOT NULL,

  -- What did the tenant decide?
  classification    VARCHAR(50) NOT NULL,
  -- 'applicable'     → applies to this institution
  -- 'not_applicable' → does not apply
  -- 'under_review'   → still being assessed

  -- When did they classify it?
  classified_at     TIMESTAMP NOT NULL,
  classified_by_user_id INT,

  -- Are they actively watching for changes?
  is_watching       BOOLEAN DEFAULT true,

  -- Notification preferences for this specific obligation
  notify_email      BOOLEAN DEFAULT true,
  notify_in_app     BOOLEAN DEFAULT true,
  notify_webhook    BOOLEAN DEFAULT true,

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE (instrument_id, tenant_id)
);
```

---

### `obligation_changes` (Central Platform)

Every time an instrument is updated on the central platform, a change record is created. This is what gets delivered to watching tenants.

```sql
CREATE TABLE obligation_changes (
  change_id         BIGINT PRIMARY KEY,
  instrument_id     BIGINT NOT NULL REFERENCES instruments(instrument_id),

  -- What changed?
  change_type       VARCHAR(50) NOT NULL,
  -- 'classification_updated' → AI re-classified (risk rating, area of focus changed)
  -- 'obligation_added'       → New specific obligation found in the document
  -- 'sanction_updated'       → Penalty amount or enforcement status changed
  -- 'superseded'             → This instrument was repealed/replaced
  -- 'applicability_clarified'→ Previously uncertain applicability is now confirmed
  -- 'status_changed'         → Draft → Published, or Published → Withdrawn

  -- The diff — what exactly changed
  changed_fields    JSONB NOT NULL,
  -- e.g. {
  --   "risk_rating": { "old": "Medium", "new": "High" },
  --   "applicability_confidence": { "old": 0.40, "new": 0.92 }
  -- }

  -- Human-readable summary of the change
  change_summary    TEXT NOT NULL,
  -- e.g. "Risk rating updated from Medium to High. New enforcement action recorded."

  -- Severity of the change (how urgent is it for tenants to review?)
  change_severity   VARCHAR(20) DEFAULT 'medium',
  -- 'low'    → minor metadata update
  -- 'medium' → classification or obligation text changed
  -- 'high'   → risk rating increased, superseded, or applicability confirmed

  -- Who/what caused it?
  changed_by        VARCHAR(50),
  -- 'ai_reclassification' | 'platform_admin' | 'scraper'

  -- For superseded instruments
  superseded_by_instrument_id BIGINT REFERENCES instruments(instrument_id),

  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

### `obligation_notifications` (Tenant Schema)

Each notification delivered to a tenant is stored in their schema.

```sql
CREATE TABLE obligation_notifications (
  notification_id   BIGINT PRIMARY KEY,

  -- Which change triggered this?
  instrument_id     BIGINT NOT NULL,
  platform_change_id BIGINT NOT NULL,   -- FK to obligation_changes on central platform

  -- What happened?
  change_type       VARCHAR(50) NOT NULL,
  change_severity   VARCHAR(20) NOT NULL,
  change_summary    TEXT NOT NULL,
  changed_fields    JSONB,              -- The diff

  -- What was the tenant's classification when this happened?
  tenant_classification VARCHAR(50),   -- 'applicable' | 'not_applicable' | 'under_review'

  -- Status
  status            VARCHAR(50) DEFAULT 'unread',
  -- 'unread'         → not yet seen
  -- 'read'           → opened in UI
  -- 'acknowledged'   → tenant reviewed and confirmed their classification is still correct
  -- 'updated'        → tenant updated their classification in response

  -- When was it read/acknowledged?
  read_at           TIMESTAMP,
  acknowledged_at   TIMESTAMP,
  acknowledged_by_user_id INT,

  -- Delivery tracking
  email_sent        BOOLEAN DEFAULT false,
  email_sent_at     TIMESTAMP,
  webhook_sent      BOOLEAN DEFAULT false,
  webhook_sent_at   TIMESTAMP,

  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

### `obligation_classifications` (Tenant Schema)

Stores the tenant's applicability decision for each obligation.
Only two fields are set here — **applicable or not**. Everything deeper
(owner, controls, risk rating) is in the tenant app's separate workflow tables.

```sql
CREATE TABLE obligation_classifications (
  classification_id   BIGINT PRIMARY KEY,
  instrument_id       BIGINT NOT NULL,

  -- The one decision made on the central platform
  applicability       VARCHAR(50) NOT NULL DEFAULT 'under_review',
  -- 'applicable' | 'not_applicable' | 'under_review'

  applicability_reasoning TEXT,
  -- e.g. "GTB operates ATMs in 500+ locations. Directly relevant."

  -- Classification version (increments each time the decision changes)
  classification_version INT DEFAULT 1,

  -- Who made the decision and when
  classified_by_user_id INT REFERENCES users(user_id),
  classified_at         TIMESTAMP DEFAULT NOW(),

  -- Audit
  audit_hash            VARCHAR(64),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),

  UNIQUE (instrument_id)

  -- Note: owner assignment, control linking, internal risk rating,
  -- and gap management are stored in the tenant app's
  -- obligation_details table (designed in the tenant app session).
);
```

---

### `classification_history` (Tenant Schema)

Every change to a classification is preserved — who changed what and why.

```sql
CREATE TABLE classification_history (
  history_id          BIGINT PRIMARY KEY,
  instrument_id       BIGINT NOT NULL,
  classification_version INT NOT NULL,

  -- Snapshot of classification at this version
  applicability       VARCHAR(50),
  tenant_risk_rating  VARCHAR(20),
  assigned_owner_user_id INT,
  linked_control_ids  INT[],
  has_gap             BOOLEAN,

  -- Why was it changed?
  change_reason       TEXT,
  -- e.g. "Platform notified: risk rating updated from Medium to High. Reviewed and confirmed applicable."

  -- Triggered by a platform notification?
  triggered_by_notification_id BIGINT,

  changed_by_user_id  INT REFERENCES users(user_id),
  changed_at          TIMESTAMP DEFAULT NOW()
);
```

---

## Part 2 — How Change Notifications Work (End to End)

```
CENTRAL PLATFORM

1. Scraper detects CBN has updated a circular
2. OCR + AI re-classify the new version
3. AI finds: risk_rating changed Medium → High, new obligation added in Section 6
4. ClassificationService computes diff:
   {
     "risk_rating": { "old": "Medium", "new": "High" },
     "obligations": { "added": ["Section 6.1: Banks must..."] }
   }
5. Inserts row into obligation_changes:
   change_type: 'classification_updated'
   change_severity: 'high'  (risk rating increased)
   change_summary: "Risk rating updated Medium → High. New obligation added in Section 6."
   changed_fields: { ... diff ... }

6. Queries obligation_watches for this instrument_id
   → Finds 18 tenants who classified this obligation
   → Finds GTB (classified: 'applicable'), Access Bank ('applicable'), Cowrywise ('not_applicable')

7. For each watching tenant:
   a. Inserts into tenant's obligation_notifications table
   b. Sends email notification (if notify_email = true)
   c. Sends webhook event obligation.classification_updated (if notify_webhook = true)
   d. Increments unread notification count for in-app badge

TENANT (GTB)

8. Ngozi opens Atheris
9. Sees notification badge: "3 obligation updates need your review"
10. Opens notification:
    "CBN ATM Cash Disbursement circular was updated.
     Risk rating changed: Medium → High
     New obligation added in Section 6.
     Your current classification: Applicable
     Action: Review and confirm your classification is still correct."

11. Ngozi clicks "Review"
12. Sees the diff view — what changed highlighted
13. Reads Section 6 — confirms it still applies to GTB
14. Clicks "Confirm — classification still correct"
15. system logs:
    obligation_classifications updated: classification_version → 2
    classification_history row inserted: change_reason = "Reviewed after platform update. Confirmed applicable."
    obligation_notifications updated: status → 'acknowledged'
```

---

## Part 3 — REST APIs

### Obligation Browser (Central Platform)

```
GET /api/v1/intelligence/obligations
    Query params:
      ?q=ATM+cash+24+hours        → full-text search
      ?regulator=CBN              → filter by regulator
      ?theme=AML                  → filter by theme
      ?risk_rating=High           → filter by risk rating
      ?instrument_type=Circular   → filter by doc type
      ?applicable_to=Commercial+Bank → filter by licence type
      ?since=2026-01-01           → published after date
      ?page=1&page_size=20

GET /api/v1/intelligence/obligations/{id}
    → Full detail: AI summary, specific obligations, sanctions, applicability, PDF link

GET /api/v1/intelligence/obligations/{id}/pdf
    → Signed S3 URL to original PDF (1h expiry)

GET /api/v1/intelligence/obligations/export
    → Download as CSV or Excel
    Query: ?format=csv|xlsx&regulator=CBN&risk_rating=High
```

### Obligation Inbox

```
GET /api/v1/intelligence/inbox
    → Obligations received but not yet classified
    Query: ?status=unclassified|applicable|not_applicable|under_review

POST /api/v1/intelligence/obligations/{id}/classify
     → Mark an obligation applicable or not applicable
     → This is the ONLY classification action on the central platform
     → Creates a watch so tenant is notified of future changes
     Body: {
       "applicability": "applicable",
       "applicability_reasoning": "GTB operates ATMs in 500+ locations."
     }
     Response: {
       "classification_id": 891,
       "instrument_id": 4821,
       "applicability": "applicable",
       "classified_at": "2026-06-02T11:32:00Z",
       "watch_created": true,
       "message": "Obligation marked applicable. You will be notified of any updates.",
       "next_step": "Open in compliance workspace to assign owner and link controls."
     }

     Note: Assigning owner, linking controls, internal risk rating, and
     gap management are handled in the tenant compliance workspace (tenant app).

PUT /api/v1/intelligence/obligations/{id}/classify
    → Update applicability decision (applicable ↔ not applicable ↔ under review)
    Body: {
      "applicability": "not_applicable",
      "applicability_reasoning": "GTB does not hold a capital markets licence.",
      "change_reason": "Reviewed after platform notification — confirmed not applicable."
    }

GET /api/v1/intelligence/obligations/{id}/classification
    → Get tenant's current classification for this obligation

GET /api/v1/intelligence/obligations/{id}/history
    → Full classification history with diffs
```

### Change Notifications

```
GET /api/v1/intelligence/notifications
    → All notifications for this tenant
    Query: ?status=unread|read|acknowledged&severity=high

GET /api/v1/intelligence/notifications/count
    → Unread count for badge display
    Response: { "unread": 3, "high_severity_unread": 1 }

GET /api/v1/intelligence/notifications/{id}
    → Full notification with diff view

PUT /api/v1/intelligence/notifications/{id}/read
    → Mark as read

PUT /api/v1/intelligence/notifications/{id}/acknowledge
    → Tenant confirms classification is still correct (no change needed)
    Body: { "notes": "Reviewed. Classification still correct." }

PUT /api/v1/intelligence/notifications/{id}/update-classification
    → Tenant updates classification in response to notification
    Body: { same as classify body + "change_reason": "..." }

PUT /api/v1/intelligence/notifications/mark-all-read
    → Mark all notifications as read
```

### Watch Management

```
GET /api/v1/intelligence/watches
    → All obligations the tenant is watching
    Query: ?classification=applicable|not_applicable

PUT /api/v1/intelligence/watches/{instrument_id}/preferences
    → Update notification preferences for one obligation
    Body: {
      "notify_email": true,
      "notify_in_app": true,
      "notify_webhook": false
    }

DELETE /api/v1/intelligence/watches/{instrument_id}
       → Stop watching (unclassify) an obligation
```

---

## Part 4 — Notification Email Templates

### Change Notification Email

```
Subject: Update: CBN ATM Cash Disbursement circular — action may be required

Hi {full_name},

A regulatory obligation you have classified has been updated on the Atheris platform.

Obligation: {instrument_title}
Regulator:  {regulator_abbreviation}
Your classification: {applicability}

What changed:
  Risk rating     : Medium → High
  New obligation  : Section 6.1 added — "Banks must..."
  Change severity : High

This change may affect your compliance position. Please review your
classification and confirm it is still correct.

[ Review update ]
{review_link}

If your classification needs no changes, you can acknowledge this
update directly:

[ Confirm — no changes needed ]
{acknowledge_link}

— The Atheris Platform
```

### Superseded Notification Email

```
Subject: Regulatory update: {instrument_title} has been superseded

Hi {full_name},

An obligation you have classified as {applicability} has been withdrawn
and replaced by a newer instrument.

Old: {old_instrument_title} (published {old_date})
New: {new_instrument_title} (published {new_date})

You may wish to:
  1. Review your classification against the new instrument
  2. Update any controls linked to the old obligation
  3. Mark the old obligation as superseded in your records

[ Review new obligation ]
{review_link}

— The Atheris Platform
```

---

## Part 5 — The ChangeNotificationService.java

```java
@Service
@Slf4j
public class ChangeNotificationService {

    @Autowired private ObligationWatchRepository watches;
    @Autowired private ObligationChangeRepository changes;
    @Autowired private TenantNotificationClient tenantClient;
    @Autowired private EmailService emailService;
    @Autowired private WebhookService webhooks;
    @Autowired private JobQueueService jobQueue;

    /**
     * Called by ClassificationService after re-classifying an instrument.
     * Computes diff, stores change, notifies all watching tenants.
     */
    public void notifyWatchers(Long instrumentId, Map<String, Object> diff,
                                String changeType, String changeSummary) {

        // 1. Determine severity from the diff
        String severity = computeSeverity(diff, changeType);

        // 2. Store the change record
        ObligationChange change = changes.insert(ObligationChange.builder()
            .instrumentId(instrumentId)
            .changeType(changeType)
            .changedFields(diff)
            .changeSummary(changeSummary)
            .changeSeverity(severity)
            .changedBy("ai_reclassification")
            .build()
        );

        // 3. Find all tenants watching this obligation
        List<ObligationWatch> watchers = watches.findByInstrumentId(instrumentId);

        if (watchers.isEmpty()) {
            log.info("No watchers for instrument {}. No notifications sent.", instrumentId);
            return;
        }

        log.info("Notifying {} watchers of change to instrument {}",
            watchers.size(), instrumentId);

        // 4. Enqueue notification delivery for each watcher
        // (done via job queue to avoid blocking classification pipeline)
        for (ObligationWatch watcher : watchers) {
            jobQueue.enqueue(
                JobType.DELIVER_CHANGE_NOTIFICATION,
                instrumentId,
                JobPriority.HIGH,
                Map.of(
                    "tenant_id",    watcher.getTenantId(),
                    "change_id",    change.getChangeId(),
                    "watch_id",     watcher.getWatchId(),
                    "severity",     severity,
                    "notify_email",   watcher.isNotifyEmail(),
                    "notify_webhook", watcher.isNotifyWebhook()
                )
            );
        }
    }

    /**
     * Processes one notification delivery job.
     * Called by cron processor every 2 minutes.
     */
    public void deliverNotification(String tenantId, Long changeId,
                                     boolean notifyEmail, boolean notifyWebhook) {

        ObligationChange change = changes.findById(changeId).orElseThrow();

        // 1. Insert notification into tenant's schema
        tenantClient.insertNotification(tenantId, ObligationNotificationDto.builder()
            .instrumentId(change.getInstrumentId())
            .platformChangeId(changeId)
            .changeType(change.getChangeType())
            .changeSeverity(change.getChangeSeverity())
            .changeSummary(change.getChangeSummary())
            .changedFields(change.getChangedFields())
            .status("unread")
            .build()
        );

        // 2. Send email if configured
        if (notifyEmail) {
            emailService.sendChangeNotification(tenantId, change);
        }

        // 3. Send webhook if configured
        if (notifyWebhook) {
            webhooks.deliver(tenantId, change.getInstrumentId(),
                buildWebhookPayload(change), "obligation.classification_updated");
        }

        log.info("Notification delivered to tenant {} for change {}",
            tenantId, changeId);
    }

    /**
     * Computes severity from the diff.
     * Risk rating increases and superseded are always 'high'.
     */
    private String computeSeverity(Map<String, Object> diff, String changeType) {
        if ("superseded".equals(changeType)) return "high";
        if ("applicability_clarified".equals(changeType)) return "high";

        if (diff.containsKey("risk_rating")) {
            Map<String, String> riskChange = (Map) diff.get("risk_rating");
            String oldRating = riskChange.get("old");
            String newRating = riskChange.get("new");

            // Risk increased → high severity
            if ("Low".equals(oldRating) && "High".equals(newRating)) return "high";
            if ("Low".equals(oldRating) && "Medium".equals(newRating)) return "medium";
            if ("Medium".equals(oldRating) && "High".equals(newRating)) return "high";
        }

        if (diff.containsKey("obligations")) return "medium"; // New obligation added
        if (diff.containsKey("sanctions")) return "medium";   // Sanction changed

        return "low";
    }
}
```

---

## Part 6 — Folder Structure (New Modules)

```
Central platform:
modules/
├── obligation-browser/
│   ├── ObligationBrowserController.java   ← Search, filter, export, detail
│   ├── ObligationBrowserService.java
│   └── dto/
│       ├── ObligationSearchRequest.java
│       └── ObligationDetailDto.java
│
├── obligation-inbox/
│   ├── InboxController.java               ← Received obligations + mark applicable
│   ├── InboxService.java
│   └── dto/
│       └── ClassifyApplicabilityRequest.java  ← ONLY applicability + reasoning
│
└── change-notifications/
    ├── ChangeNotificationService.java     ← Computes diff, notifies watchers
    ├── ObligationChange.java              ← Entity
    ├── ObligationChangeRepository.java
    ├── ObligationWatch.java               ← Entity
    ├── ObligationWatchRepository.java
    └── dto/
        ├── ObligationChangeDto.java
        └── DiffDto.java

Tenant app (next session):
modules/
├── obligation-details/                    ← Owner, controls, risk rating, gaps
├── classifications/                       ← Full classification history
└── notifications/                         ← Receives + stores platform notifications
    ├── ObligationNotification.java
    ├── NotificationRepository.java
    ├── NotificationService.java
    └── NotificationController.java
```

---

## Summary — The Complete Intelligence Loop

```
CENTRAL PLATFORM

1.  CBN publishes new circular
2.  Scraper detects it (within 15 minutes)
3.  OCR extracts text
4.  AI classifies → instruments table
5.  Applicability filter → which tenants get it
6.  Webhook / UI inbox / REST API → tenant receives it
7.  Tenant marks: applicable / not applicable
    → obligation_watches row created ("I am watching this")
    → obligation_classifications row created (applicability + reasoning)
    → Central platform now tracks this tenant as a watcher

8.  CBN updates the circular (weeks/months later)
9.  Scraper detects the update
10. AI re-classifies → diff computed
11. obligation_changes row inserted on central platform
12. All watchers notified:
      → in-app notification (unread badge)
      → email (what changed + review link)
      → webhook event (obligation.classification_updated)
13. Ngozi opens the notification, reads the diff
14. Clicks "Confirm — no change needed" OR updates her applicability decision
15. classification_history row inserted — full audit trail

TENANT APP (separate flow — next session)

16. Ngozi opens the tenant compliance workspace
17. Sees the applicable obligation in her obligations register
18. Assigns owner, links controls, sets internal risk rating
19. Raises gap if no control exists
20. From here: control testing, findings, returns, board dashboard
```

### The Boundary in One Sentence

The central platform answers: **"Does this regulation apply to us?"**
The tenant app answers: **"What are we doing about it?"**
