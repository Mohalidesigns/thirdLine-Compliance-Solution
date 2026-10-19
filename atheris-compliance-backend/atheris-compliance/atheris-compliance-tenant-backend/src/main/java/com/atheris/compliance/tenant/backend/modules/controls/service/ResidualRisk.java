package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;

public final class ResidualRisk {

    private ResidualRisk() {}

    public static String fromTestResult(String result, String inherentRisk) {
        String risk = switch (result == null ? "" : result) {
            case WorkflowStatus.TEST_PASSED -> WorkflowStatus.RISK_LOW;
            case WorkflowStatus.TEST_PARTIAL -> WorkflowStatus.RISK_MEDIUM;
            case WorkflowStatus.TEST_FAILED -> inherentRisk;
            default -> null;
        };
        return capAtInherent(risk, inherentRisk);
    }

    public static String capAtInherent(String risk, String inherentRisk) {
        if (risk == null) {
            return null;
        }
        int r = rank(risk);
        int i = rank(inherentRisk);
        return i > 0 && r > i ? inherentRisk : risk;
    }

    public static int rank(String band) {
        if (band == null) {
            return 0;
        }
        return switch (band) {
            case WorkflowStatus.RISK_LOW -> 1;
            case WorkflowStatus.RISK_MODERATE, WorkflowStatus.RISK_MEDIUM -> 2;
            case WorkflowStatus.RISK_HIGH -> 3;
            case WorkflowStatus.RISK_CRITICAL -> 4;
            default -> 0;
        };
    }
}
