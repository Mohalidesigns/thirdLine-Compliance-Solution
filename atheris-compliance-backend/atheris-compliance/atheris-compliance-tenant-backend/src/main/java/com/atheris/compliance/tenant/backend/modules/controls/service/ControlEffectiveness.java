package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;

public final class ControlEffectiveness {

    public static final String EFFECTIVE = "EFFECTIVE";
    public static final String PARTIAL = "PARTIAL";
    public static final String INEFFECTIVE = "INEFFECTIVE";
    public static final String UNTESTED = "UNTESTED";

    private ControlEffectiveness() {}

    public static String of(String latestAcceptedResult, long openFindings) {
        if (openFindings > 0) return INEFFECTIVE;
        if (latestAcceptedResult == null || latestAcceptedResult.isBlank()) return UNTESTED;
        if (WorkflowStatus.TEST_PASSED.equalsIgnoreCase(latestAcceptedResult)) return EFFECTIVE;
        if (WorkflowStatus.TEST_PARTIAL.equalsIgnoreCase(latestAcceptedResult)) return PARTIAL;
        if (WorkflowStatus.TEST_FAILED.equalsIgnoreCase(latestAcceptedResult)) return INEFFECTIVE;
        return UNTESTED;
    }

    public static boolean isEffective(String state) {
        return EFFECTIVE.equals(state);
    }

    public static String reason(String latestAcceptedResult, java.time.LocalDate latestTestDate, long openFindings) {
        if (openFindings > 0) {
            return openFindings + " open finding" + (openFindings == 1 ? "" : "s")
                + (latestAcceptedResult == null ? "" : " · latest test " + latestAcceptedResult);
        }
        if (latestAcceptedResult == null || latestAcceptedResult.isBlank()) {
            return "No accepted test recorded yet.";
        }
        return "Latest accepted test " + latestAcceptedResult
            + (latestTestDate == null ? "" : " on " + latestTestDate);
    }
}