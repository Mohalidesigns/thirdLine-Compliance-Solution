package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Compliance is derived, never stored. A requirement is judged by the latest test of each control
 * linked to it; an obligation by the requirements it holds.
 */
public final class ComplianceState {

    public static final String NO_CONTROL = "NO_CONTROL";
    public static final String NON_COMPLIANT = "NON_COMPLIANT";
    public static final String PARTIAL = "PARTIAL";
    public static final String COMPLIANT = "COMPLIANT";
    public static final String GAP = "GAP";
    public static final String NO_REQUIREMENTS = "NO_REQUIREMENTS";

    private ComplianceState() {}

    /** A control is effective only when its latest recorded test passed; untested is not effective. */
    public static boolean effective(String latestResult) {
        return WorkflowStatus.TEST_PASSED.equalsIgnoreCase(latestResult);
    }

    public static boolean failed(String latestResult) {
        return WorkflowStatus.TEST_FAILED.equalsIgnoreCase(latestResult);
    }

    /**
     * All linked controls effective is compliant; some effective is partial; none effective is
     * non-compliant when a control has failed, and partial when they are merely untested (not yet
     * proven either way, so not an accusation).
     * @param latestResultByControl control id → latest test result (absent/null = never tested) */
    public static String ofRequirement(Requirement requirement, Collection<Integer> controlIds,
                                       Map<Integer, String> latestResultByControl) {
        if (requirement.getStateOverride() != null && !requirement.getStateOverride().isBlank()) {
            return requirement.getStateOverride();
        }
        if (controlIds == null || controlIds.isEmpty()) return NO_CONTROL;
        long effective = controlIds.stream().filter(id -> effective(latestResultByControl.get(id))).count();
        if (effective == controlIds.size()) return COMPLIANT;
        if (effective > 0) return PARTIAL;
        boolean anyFailed = controlIds.stream().anyMatch(id -> failed(latestResultByControl.get(id)));
        return anyFailed ? NON_COMPLIANT : PARTIAL;
    }

    /** Worst first: any non-compliant requirement, then any gap, then partial, else compliant. */
    public static String ofObligation(List<String> requirementStates) {
        if (requirementStates == null || requirementStates.isEmpty()) return NO_REQUIREMENTS;
        if (requirementStates.contains(NON_COMPLIANT)) return NON_COMPLIANT;
        if (requirementStates.contains(NO_CONTROL)) return GAP;
        if (requirementStates.stream().allMatch(COMPLIANT::equals)) return COMPLIANT;
        return PARTIAL;
    }

    /** A gap is a requirement no control covers, even when the obligation's other duties are covered. */
    public static boolean isGap(String requirementState) {
        return NO_CONTROL.equals(requirementState);
    }
}
