package com.atheris.compliance.tenant.backend.shared.util;

/**
 * Canonical workflow status/result strings. These are persisted values, so the constants
 * must match the exact strings the DB already stores. Centralised so the controls, findings
 * and returns modules can never drift apart.
 */
public final class WorkflowStatus {

    private WorkflowStatus() {}

    /** Control task lifecycle. */
    public static final String TASK_PENDING = "Pending";
    public static final String TASK_IN_PROGRESS = "In Progress";
    public static final String TASK_OVERDUE = "Overdue";
    public static final String TASK_COMPLETED = "Completed";
    public static final String TASK_TYPE_SCHEDULED_TEST = "scheduled_test";

    /** Control test result. */
    public static final String TEST_PASSED = "Passed";
    public static final String TEST_PARTIAL = "Partial";
    public static final String TEST_FAILED = "Failed";

    /** Control test review decision / review state. */
    public static final String REVIEW_PENDING = "Pending";
    public static final String REVIEW_ACCEPTED = "Accepted";
    public static final String REVIEW_REJECTED = "Rejected";

    /** Finding lifecycle. */
    public static final String FINDING_OPEN = "Open";
    public static final String FINDING_IN_REMEDIATION = "In Remediation";
    public static final String FINDING_REMEDIATED = "Remediated";
    public static final String FINDING_CLOSED = "Closed";

    /** Finding types. */
    public static final String FINDING_TYPE_CONTROL_FAILURE = "Control Failure";
    public static final String FINDING_TYPE_GAP = "Gap";

    /** Severity bands (obligations and findings). */
    public static final String RISK_CRITICAL = "Critical";
    public static final String RISK_HIGH = "High";
    public static final String RISK_MODERATE = "Moderate";
    public static final String RISK_MEDIUM = "Medium";
    public static final String RISK_LOW = "Low";
}