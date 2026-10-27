package com.atheris.compliance.tenant.backend.shared.util;

public final class EscalationConstants {

    private EscalationConstants() {}

    public static final String SUBJECT_RETURN = "RETURN";
    public static final String SUBJECT_CONTROL = "CONTROL";

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
    public static final String TRIGGER_GATHERING = "GATHERING";

    public static final String CHANNEL_EMAIL = "EMAIL";

    public static final int MAX_LEVEL = 3;

    public static final String KEY_RETURN_APPROACHING = "return.filing.approaching";
    public static final String KEY_RETURN_REMINDER = "return.filing.reminder";
    public static final String KEY_RETURN_OVERDUE = "return.filing.overdue";
    public static final String KEY_RETURN_GATHERING = "return.filing.gathering";
    public static final String KEY_CONTROL_APPROACHING = "control.test.approaching";
    public static final String KEY_CONTROL_OVERDUE = "control.test.overdue";

    public static final String KEY_RETURN_REPORT_REVIEW = "return.filing.report_review";
    public static final String KEY_RETURN_DATA_REVIEW = "return.filing.data_review";
    public static final String KEY_RETURN_DATA_RECEIPT = "return.filing.data_receipt";
    public static final String KEY_RETURN_CHANGES_REQUESTED = "return.filing.changes_requested";
}
