package com.atheris.compliance.tenant.backend.shared.util;

public final class EscalationConstants {

    private EscalationConstants() {}

    public static final String SUBJECT_RETURN = "RETURN";
    public static final String SUBJECT_CONTROL = "CONTROL";
    public static final String SUBJECT_FINDING = "FINDING";

    public static final String TARGET_ASSIGNEE = "ASSIGNEE";
    public static final String TARGET_MANAGER = "MANAGER";
    public static final String TARGET_MANAGER_OF_MANAGER = "MANAGER_OF_MANAGER";
    public static final String TARGET_PERSON = "PERSON";
    public static final String TARGET_ROLE = "ROLE";

    public static final String UNIT_DAYS = "DAYS";
    public static final String UNIT_HOURS = "HOURS";

    public static final String TRIGGER_APPROACHING = "APPROACHING";
    public static final String TRIGGER_REMINDER = "REMINDER";
    public static final String TRIGGER_OVERDUE = "OVERDUE";

    public static final String CHANNEL_EMAIL = "EMAIL";

    public static final int MAX_LEVEL = 3;

    public static final String KEY_RETURN_APPROACHING = "return.filing.approaching";
    public static final String KEY_RETURN_REMINDER = "return.filing.reminder";
    public static final String KEY_RETURN_FILING_REQUEST = "return.filing.request";
    public static final String KEY_RETURN_OVERDUE = "return.filing.overdue";
    public static final String KEY_CONTROL_APPROACHING = "control.test.approaching";
    public static final String KEY_CONTROL_REMINDER = "control.test.reminder";
    public static final String KEY_CONTROL_REQUEST = "control.test.request";
    public static final String KEY_CONTROL_OVERDUE = "control.test.overdue";
    public static final String KEY_CONTROL_DATA_REVIEW = "control.test.data_review";
    public static final String KEY_CONTROL_DATA_RECEIPT = "control.test.data_receipt";
    public static final String KEY_CONTROL_CHANGES_REQUESTED = "control.test.changes_requested";

    public static final String KEY_FINDING_RAISED = "finding.remediation.raised";
    public static final String KEY_FINDING_APPROACHING = "finding.remediation.approaching";
    public static final String KEY_FINDING_REMINDER = "finding.remediation.reminder";
    public static final String KEY_FINDING_OVERDUE = "finding.remediation.overdue";
    public static final String KEY_FINDING_DATA_REVIEW = "finding.remediation.submitted";
    public static final String KEY_FINDING_RECEIPT = "finding.remediation.receipt";
    public static final String KEY_FINDING_CHANGES_REQUESTED = "finding.remediation.changes_requested";

    public static final String KEY_RETURN_REPORT_REVIEW = "return.filing.report_review";
    public static final String KEY_RETURN_DATA_REVIEW = "return.filing.data_review";
    public static final String KEY_RETURN_DATA_RECEIPT = "return.filing.data_receipt";
    public static final String KEY_RETURN_CHANGES_REQUESTED = "return.filing.changes_requested";
}
