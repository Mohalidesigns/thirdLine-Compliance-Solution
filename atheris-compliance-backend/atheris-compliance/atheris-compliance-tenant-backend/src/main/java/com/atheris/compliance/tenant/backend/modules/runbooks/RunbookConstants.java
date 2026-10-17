package com.atheris.compliance.tenant.backend.modules.runbooks;

import java.util.List;
import java.util.Set;

/**
 * Persisted string values for the Compliance Runbooks module. They must match the strings the
 * frontend sends and the database stores (see the runbooks API contract).
 */
public final class RunbookConstants {

    private RunbookConstants() {}

    public static final String SUBJECT_RUNBOOK = "runbook";
    public static final String SUBJECT_EXECUTION = "runbook_execution";
    public static final String NOTIFICATION_CATEGORY = "runbooks";
    public static final String EVIDENCE_SOURCE_STEP = "RUNBOOK_STEP";
    public static final String EVIDENCE_SOURCE_PACK = "RUNBOOK_PACK";

    // Runbook lifecycle
    public static final String RB_DRAFT = "DRAFT";
    public static final String RB_IN_REVIEW = "IN_REVIEW";
    public static final String RB_PUBLISHED = "PUBLISHED";
    public static final String RB_DEPRECATED = "DEPRECATED";
    public static final String RB_ARCHIVED = "ARCHIVED";

    // Version lifecycle
    public static final String V_DRAFT = "DRAFT";
    public static final String V_IN_REVIEW = "IN_REVIEW";
    public static final String V_PUBLISHED = "PUBLISHED";
    public static final String V_SUPERSEDED = "SUPERSEDED";
    public static final List<String> OPEN_VERSION_STATUSES = List.of(V_DRAFT, V_IN_REVIEW);

    // Execution lifecycle
    public static final String EX_NOT_STARTED = "NOT_STARTED";
    public static final String EX_PREFLIGHT = "PREFLIGHT";
    public static final String EX_IN_PROGRESS = "IN_PROGRESS";
    public static final String EX_PAUSED = "PAUSED";
    public static final String EX_ESCALATED = "ESCALATED";
    public static final String EX_ROLLING_BACK = "ROLLING_BACK";
    public static final String EX_PENDING_SIGNOFF = "PENDING_SIGNOFF";
    public static final String EX_COMPLETED_PASS = "COMPLETED_PASS";
    public static final String EX_COMPLETED_FAIL = "COMPLETED_FAIL";
    public static final String EX_ABORTED = "ABORTED";
    /** An execution in one of these states is still being worked (SLA timers run). */
    public static final List<String> ACTIVE_EXECUTION_STATUSES =
        List.of(EX_NOT_STARTED, EX_PREFLIGHT, EX_IN_PROGRESS, EX_PAUSED, EX_ESCALATED, EX_ROLLING_BACK);
    /** States in which an operator may act on steps. */
    public static final Set<String> WORKABLE_EXECUTION_STATUSES = Set.of(EX_IN_PROGRESS, EX_ESCALATED, EX_ROLLING_BACK);
    public static final Set<String> CLOSED_EXECUTION_STATUSES = Set.of(EX_COMPLETED_PASS, EX_COMPLETED_FAIL, EX_ABORTED);

    public static final String OUTCOME_PASS = "PASS";
    public static final String OUTCOME_FAIL = "FAIL";

    // Step execution
    public static final String ST_PENDING = "PENDING";
    public static final String ST_IN_PROGRESS = "IN_PROGRESS";
    public static final String ST_AWAITING_VERIFICATION = "AWAITING_VERIFICATION";
    public static final String ST_PASSED = "PASSED";
    public static final String ST_FAILED = "FAILED";
    public static final String ST_SKIPPED = "SKIPPED";
    public static final String ST_NA = "NA";
    public static final Set<String> TERMINAL_STEP_STATUSES = Set.of(ST_PASSED, ST_FAILED, ST_SKIPPED, ST_NA);

    // Escalation triggers
    public static final String TRIG_STEP_FAILED = "STEP_FAILED";
    public static final String TRIG_SLA_50 = "SLA_50";
    public static final String TRIG_SLA_80 = "SLA_80";
    public static final String TRIG_SLA_BREACH = "SLA_BREACH";
    public static final String TRIG_MANUAL = "MANUAL";

    public static final String CHANNEL_EMAIL = "EMAIL";

    // Sign-off
    public static final String SIGN_OPERATOR = "OPERATOR";
    public static final String SIGN_REVIEWER = "REVIEWER";
    public static final String SIGN_CCO = "CCO";
    public static final String SIGN_AUDITOR = "AUDITOR";
    public static final String DECISION_ACCEPTED = "ACCEPTED";
    public static final String DECISION_REJECTED = "REJECTED";

    // Approvals
    public static final String APPROVAL_APPROVED = "APPROVED";
    public static final String APPROVAL_REJECTED = "REJECTED";
    public static final String APPROVAL_CHANGES_REQUESTED = "CHANGES_REQUESTED";

    public static final String SECTION_EXECUTION = "EXECUTION";

    public static final Set<String> CATEGORIES = Set.of("ACCESS_REVIEW", "VULN_MGMT", "INCIDENT", "CONFIG_AUDIT",
        "CRYPTO", "BCP_DR", "PRIVACY", "AML", "RETURNS", "VENDOR", "CHANGE", "LOGGING", "CUSTOM");
    public static final List<String> CRITICALITIES = List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    public static final Set<String> FREQUENCIES = Set.of("ON_DEMAND", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY",
        "SEMI_ANNUAL", "ANNUAL", "EVENT_DRIVEN");
    public static final Set<String> REVIEW_CADENCES = Set.of("QUARTERLY", "SEMI_ANNUAL", "ANNUAL");
    public static final Set<String> SECTION_TYPES = Set.of("PRECHECK", "EXECUTION", "VERIFICATION", "CLOSEOUT");
    public static final Set<String> EVIDENCE_TYPES = Set.of("SCREENSHOT", "LOG_FILE", "QUERY_OUTPUT", "TICKET_REF",
        "ATTESTATION", "DOCUMENT", "CONFIG_EXPORT", "EMAIL", "SIGNED_FORM");
    public static final Set<String> PREREQ_TYPES = Set.of("ACCESS", "TOOL", "CREDENTIAL", "APPROVAL", "DATA", "WINDOW");
    public static final Set<String> ESCALATION_TRIGGERS = Set.of(TRIG_STEP_FAILED, TRIG_SLA_50, TRIG_SLA_80, TRIG_SLA_BREACH, TRIG_MANUAL);
    public static final Set<String> TRIGGER_TYPES = Set.of("SCHEDULED", "MANUAL", "INCIDENT", "FINDING", "REVIEW");
    public static final Set<String> FAILURE_CATEGORIES = Set.of("BLOCKED", "DEVIATION", "ERROR", "NOT_APPLICABLE");

    /** Runbook-code prefix per category: RB-ACC-001 etc. */
    public static String codePrefix(String category) {
        return switch (category == null ? "" : category) {
            case "ACCESS_REVIEW" -> "ACC";
            case "VULN_MGMT" -> "VUL";
            case "INCIDENT" -> "INC";
            case "CONFIG_AUDIT" -> "CFG";
            case "CRYPTO" -> "CRY";
            case "BCP_DR" -> "BCP";
            case "PRIVACY" -> "PRV";
            case "AML" -> "AML";
            case "RETURNS" -> "RET";
            case "VENDOR" -> "VND";
            case "CHANGE" -> "CHG";
            case "LOGGING" -> "LOG";
            default -> "CUS";
        };
    }

    /** HIGH/CRITICAL runbooks need a second person's approval before publishing (spec §8.1). */
    public static boolean requiresApproval(String criticality) {
        return "HIGH".equals(criticality) || "CRITICAL".equals(criticality);
    }
}
