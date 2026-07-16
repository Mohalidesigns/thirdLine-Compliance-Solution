package com.atheris.compliance.common;

import java.time.Duration;
import java.util.List;

public final class Constants {

    private Constants() {}

    // ── Job / Pipeline Status ──
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_PROCESSING = "processing";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_FAILED = "failed";
    public static final String STATUS_DELIVERED = "delivered";
    public static final String STATUS_SUCCESS = "success";
    public static final String STATUS_PARTIAL_FAILURE = "partial_failure";

    // ── Instrument Status ──
    public static final String INST_TRIAGE = "Triage";
    public static final String INST_PUBLISHED = "Published";
    public static final String INST_SUPERSEDED = "Superseded";
    public static final String INST_WITHDRAWN = "Withdrawn";

    // ── Risk Ratings ──
    public static final String RISK_HIGH = "High";
    public static final String RISK_MEDIUM = "Medium";
    public static final String RISK_LOW = "Low";

    // ── Nature ──
    public static final String NATURE_CORE = "Core";
    public static final String NATURE_SECONDARY = "Secondary";
    public static final String NATURE_GUIDANCE = "Guidance";

    // ── Obligation Types ──
    public static final String OBLIGATION_TYPE_OPERATIONAL = "Operational";
    public static final String OBLIGATION_TYPE_REPORTING = "Reporting";
    public static final String OBLIGATION_TYPE_GOVERNANCE = "Governance";
    public static final String OBLIGATION_TYPE_ONE_TIME = "One-time";

    // ── SCRA Periods ──
    public static final String SCRA_PERIOD_CONTINUOUS = "Continuous";
    public static final String SCRA_PERIOD_MONTHLY = "Monthly";
    public static final String SCRA_PERIOD_QUARTERLY = "Quarterly";
    public static final String SCRA_PERIOD_ANNUAL = "Annual";

    // ── Tenant Classification ──
    public static final String CLASS_UNCLASSIFIED = "unclassified";
    public static final String CLASS_APPLICABLE = "applicable";
    public static final String CLASS_NOT_APPLICABLE = "not_applicable";
    public static final String CLASS_UNDER_REVIEW = "under_review";

    // ── HTTP / Auth ──
    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String HEADER_CONTENT_TYPE = "Content-Type";
    public static final String HEADER_USER_AGENT = "User-Agent";
    public static final String HEADER_CONTENT_LENGTH = "Content-Length";
    public static final String BEARER_PREFIX = "Bearer ";
    public static final String ROLE_PREFIX = "ROLE_";
    public static final String JWT_CLAIM_ROLE = "role";

    // ── MIME Types ──
    public static final String MIME_PDF = "application/pdf";
    public static final String MIME_JSON = "application/json";
    public static final String MIME_OCTET_STREAM = "octet-stream";

    // ── Storage / S3 ──
    public static final String AWS_REGION = "af-south-1";
    public static final String S3_KEY_RAW_PREFIX = "raw/";
    public static final String S3_KEY_INSTRUMENTS_PREFIX = "instruments/";
    public static final String S3_METADATA_PDF_HASH = "pdf-sha256";
    public static final String S3_RANGE_PREFIX = "bytes=0-";

    // ── Scraper Strategy ──
    public static final String STRATEGY_HTML = "html";
    public static final String STRATEGY_HEADLESS = "headless";

    // ── Scraper Frequency ──
    public static final String FREQ_15MIN = "15min";
    public static final String FREQ_HOURLY = "hourly";
    public static final String FREQ_DAILY = "daily";
    public static final String FREQ_WEEKLY = "weekly";

    // ── Scraper Mode ──
    public static final String MODE_MONITORING = "monitoring";
    public static final String MODE_BACKFILL = "backfill";

    // ── Scraper Pagination ──
    public static final String PAGINATION_NEXT_BUTTON = "NEXT_BUTTON";
    public static final String PAGINATION_PAGE_PARAM = "PAGE_PARAM";
    public static final String PAGINATION_YEAR_FOLDERS = "YEAR_FOLDERS";

    // ── Job Types ──
    public static final String JOB_OCR = "ocr_document";
    public static final String JOB_CLASSIFY = "classify_instrument";
    public static final String JOB_APPLICABILITY = "evaluate_applicability";
    public static final String JOB_WEBHOOK = "send_webhooks";
    public static final String JOB_CHANGE_NOTIFICATION = "deliver_change_notification";

    // ── Webhook ──
    public static final String WEBHOOK_EVENT_RECEIVED = "obligation.received";
    public static final String WEBHOOK_EVENT_SUPERSEDED = "obligation.superseded";
    public static final String WEBHOOK_EVENT_PING = "ping";
    public static final String WEBHOOK_SIG_HEADER = "X-Atheris-Signature";
    public static final String WEBHOOK_EVENT_ID_HEADER = "X-Webhook-Event-ID";
    public static final String WEBHOOK_TIMESTAMP_HEADER = "X-Webhook-Timestamp";
    public static final String WEBHOOK_SIG_PREFIX = "sha256=";
    public static final String WEBHOOK_SECRET_PREFIX = "whsec_";
    public static final String WEBHOOK_KEY_PREFIX = "webhook_";
    public static final String HMAC_ALGORITHM = "HmacSHA256";
    public static final String DIGEST_SHA256 = "SHA-256";

    // ── Tenant ──
    public static final String TENANT_PLAN_IMMEDIATE = "immediate";
    public static final String TENANT_PLAN_STARTER = "starter";
    public static final String API_KEY_PREFIX = "atk_";

    // ── Audit / Change ──
    public static final String AUDIT_SOURCE_SYSTEM = "system";
    public static final String AUDIT_SOURCE_USER = "user";
    public static final String CHANGE_TYPE_AI_RECLASSIFICATION = "ai_reclassification";
    public static final String CHANGE_TYPE_PLATFORM_ADMIN = "platform_admin";
    public static final String CHANGE_TYPE_SUPERSEDED = "superseded";
    public static final String CHANGE_TYPE_APPLICABILITY_CLARIFIED = "applicability_clarified";

    // ── License Statuses ──
    public static final String LICENSE_INACTIVE = "inactive";
    public static final String LICENSE_ACTIVE = "active";
    public static final String LICENSE_EXPIRED = "expired";
    public static final String LICENSE_REVOKED = "revoked";
    public static final String LICENSE_GRACE_PERIOD = "grace_period";
    public static final String LICENSE_SUSPENDED = "suspended";
    public static final String LICENSE_NOT_FOUND = "not_found";
    public static final String LICENSE_VALIDATION_ERROR = "validation_error";
    public static final String LICENSE_KEY_PREFIX = "ATH-";
    public static final String LICENSE_DEFAULT_TIER = "custom";
    public static final String LICENSE_NO_LICENSE = "no_license";

    // ── License Events ──
    public static final String LICENSE_EVENT_ACTIVATED = "activated";
    public static final String LICENSE_EVENT_VALIDATED = "validated";
    public static final String LICENSE_EVENT_CHECKUP = "checkup";
    public static final String LICENSE_EVENT_EXPIRED = "expired";
    public static final String LICENSE_EVENT_REVOKED = "revoked";
    public static final String LICENSE_EVENT_DEVICE_REGISTERED = "device_registered";
    public static final String LICENSE_EVENT_DEVICE_REJECTED = "device_rejected";

    // ── Email ──
    public static final String EMAIL_FROM = "noreply@atheris.com";
    public static final String EMAIL_BASE_URL = "https://app.atheris.com";

    // ── Playwright Browser ──
    public static final String PW_NO_SANDBOX = "--no-sandbox";
    public static final String PW_DISABLE_DEV_SHM = "--disable-dev-shm-usage";
    public static final String PW_DISABLE_GPU = "--disable-gpu";
    public static final String PW_DISABLE_EXTENSIONS = "--disable-extensions";
    public static final String PW_DISABLE_BG_NETWORKING = "--disable-background-networking";
    public static final String PW_WINDOW_SIZE = "--window-size=1920,1080";
    public static final String PW_BLOCK_RESOURCES = "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,mp4,mp3}";

    // ── User Agent ──
    public static final String USER_AGENT = "Atheris-HorizonScanner/1.0 (compliance@atheris.com)";

    // ── Retry Backoff (minutes) ──
    public static final int[] RETRY_BACKOFF = {5, 15, 60, 240, 1440};
}
