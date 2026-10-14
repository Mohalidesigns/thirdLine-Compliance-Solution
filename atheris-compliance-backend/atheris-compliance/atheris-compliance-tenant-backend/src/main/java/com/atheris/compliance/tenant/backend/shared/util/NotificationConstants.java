package com.atheris.compliance.tenant.backend.shared.util;

/**
 * Canonical notification strings: the categories an inbox item can belong to, the severity
 * band used for filtering/highlighting, and the per-item lifecycle status. These are
 * persisted values, so the constants must match the exact strings the DB stores.
 */
public final class NotificationConstants {

    private NotificationConstants() {}

    /** Category of a notification (drives the inbox icon/grouping). */
    public static final String CATEGORY_CONTROLS = "controls";
    public static final String CATEGORY_FINDINGS = "findings";
    public static final String CATEGORY_RETURNS = "returns";

    /** Notification severity (lower-case; distinct from the obligation risk bands). */
    public static final String SEVERITY_HIGH = "high";
    public static final String SEVERITY_MEDIUM = "medium";
    public static final String SEVERITY_LOW = "low";

    /** Per-item lifecycle status. */
    public static final String STATUS_UNREAD = "unread";
    public static final String STATUS_READ = "read";
    public static final String STATUS_ACKNOWLEDGED = "acknowledged";
}