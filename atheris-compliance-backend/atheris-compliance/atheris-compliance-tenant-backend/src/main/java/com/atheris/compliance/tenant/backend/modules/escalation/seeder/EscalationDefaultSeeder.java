package com.atheris.compliance.tenant.backend.modules.escalation.seeder;

import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
@Order(20)
public class EscalationDefaultSeeder implements ApplicationRunner {

    private final EscalationPolicyService policies;

    @Override
    public void run(ApplicationArguments args) {
        try {
            seed(EscalationConstants.SUBJECT_RETURN, null, "Standard Return Escalation",
                10, 2, true, true, standardLevels(1, 3, 7));
            seed(EscalationConstants.SUBJECT_RETURN, "DAILY", "Daily Return Escalation",
                12, 12, true, true, standardLevels(1, 2, 3), EscalationConstants.UNIT_HOURS, 0, 1);
            seed(EscalationConstants.SUBJECT_RETURN, "WEEKLY", "Weekly Return Escalation",
                2, 1, true, true, standardLevels(1, 2, 4));
            seed(EscalationConstants.SUBJECT_RETURN, "MONTHLY", "Monthly Return Escalation",
                10, 2, true, true, standardLevels(1, 3, 7));
            seed(EscalationConstants.SUBJECT_RETURN, "QUARTERLY", "Quarterly Return Escalation",
                15, 3, true, true, standardLevels(1, 5, 10));
            seed(EscalationConstants.SUBJECT_RETURN, "SEMI_ANNUAL", "Semi-Annual Return Escalation",
                21, 5, true, true, standardLevels(1, 7, 14));
            seed(EscalationConstants.SUBJECT_RETURN, "ANNUAL", "Annual Return Escalation",
                30, 7, true, true, standardLevels(1, 7, 14));
            seed(EscalationConstants.SUBJECT_RETURN, "BIENNIAL", "Biennial Return Escalation",
                30, 7, true, true, standardLevels(1, 7, 14));
            seed(EscalationConstants.SUBJECT_CONTROL, null, "Standard Control Test Escalation",
                5, 2, true, true, controlLevels());
            seed(EscalationConstants.SUBJECT_CONTROL, "MONTHLY", "Monthly Control Test Escalation",
                10, 2, true, true, controlLevels());
            seed(EscalationConstants.SUBJECT_CONTROL, "QUARTERLY", "Quarterly Control Test Escalation",
                15, 3, true, true, controlLevels());
            seed(EscalationConstants.SUBJECT_CONTROL, "SEMI_ANNUAL", "Semi-Annual Control Test Escalation",
                21, 5, true, true, controlLevels());
            seed(EscalationConstants.SUBJECT_CONTROL, "ANNUAL", "Annual Control Test Escalation",
                30, 7, true, true, controlLevels());
            seedLevels(EscalationConstants.SUBJECT_CONTROL, null, managedControl(), controlLevels());
            seedLevels(EscalationConstants.SUBJECT_CONTROL, "MONTHLY", managedControl(), controlLevels());
            seedLevels(EscalationConstants.SUBJECT_CONTROL, "QUARTERLY", managedControl(), controlLevels());
            seedLevels(EscalationConstants.SUBJECT_CONTROL, "SEMI_ANNUAL", managedControl(), controlLevels());
            seedLevels(EscalationConstants.SUBJECT_CONTROL, "ANNUAL", managedControl(), controlLevels());
            seedLevels(EscalationConstants.SUBJECT_RETURN, null, managedStandard(1, 3, 7), standardLevels(1, 3, 7));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "DAILY", managedStandard(1, 2, 3), standardLevels(1, 2, 3));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "WEEKLY", managedStandard(1, 2, 4), standardLevels(1, 2, 4));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "MONTHLY", managedStandard(1, 3, 7), standardLevels(1, 3, 7));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "QUARTERLY", managedStandard(1, 5, 10), standardLevels(1, 5, 10));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "SEMI_ANNUAL", managedStandard(1, 7, 14), standardLevels(1, 7, 14));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "ANNUAL", managedStandard(1, 7, 14), standardLevels(1, 7, 14));
            seedLevels(EscalationConstants.SUBJECT_RETURN, "BIENNIAL", managedStandard(1, 7, 14), standardLevels(1, 7, 14));
            seedLevels(EscalationConstants.SUBJECT_FINDING, null, managedFinding(), findingLevels());
            seedLevels(EscalationConstants.SUBJECT_FINDING, "CRITICAL", managedFinding(), findingLevels());
            seedLevels(EscalationConstants.SUBJECT_FINDING, "HIGH", managedFinding(), findingLevels());
            seed(EscalationConstants.SUBJECT_FINDING, null, "Standard Finding Escalation",
                7, 2, true, true, findingLevels());
            seed(EscalationConstants.SUBJECT_FINDING, "CRITICAL", "Critical Finding Escalation",
                3, 1, true, true, findingLevels());
            seed(EscalationConstants.SUBJECT_FINDING, "HIGH", "High Finding Escalation",
                5, 2, true, true, findingLevels());
            repinUntouchedFilings();
        } catch (Throwable e) {
            log.error("[EscalationSeeder] failed: {}", e.getMessage(), e);
        }
    }

    private void repinUntouchedFilings() {
        int n = policies.repinUntouched(EscalationConstants.SUBJECT_RETURN)
            + policies.repinUntouched(EscalationConstants.SUBJECT_CONTROL)
            + policies.repinUntouched(EscalationConstants.SUBJECT_FINDING);
        if (n > 0) {
            log.info("[EscalationSeeder] re-pinned {} untouched frozen filing(s) to their policy", n);
        }
    }

    private void seed(String subjectType, String frequencyScope, String name, int startValue, int repeatValue,
                      boolean sendLink, boolean notifyOnStart, List<EscalationLevelRequest> levels) {
        seed(subjectType, frequencyScope, name, startValue, repeatValue, sendLink, notifyOnStart, levels,
            EscalationConstants.UNIT_DAYS, startValue, repeatValue);
    }

    private void seed(String subjectType, String frequencyScope, String name, int startValue, int repeatValue,
                      boolean sendLink, boolean notifyOnStart, List<EscalationLevelRequest> levels, String unit,
                      int legacyStartValue, int legacyRepeatValue) {
        if (policies.hasDefaultExact(subjectType, frequencyScope)) {
            if (notifyOnStart) {
                policies.refreshSeededDefault(subjectType, frequencyScope, legacyStartValue, legacyRepeatValue,
                    startValue, unit, repeatValue, unit, sendLink);
            }
            return;
        }
        policies.create(EscalationPolicyRequest.builder()
            .name(name).subjectType(subjectType).frequencyScope(frequencyScope).isDefault(true).isActive(true)
            .reminderStartValue(startValue).reminderStartUnit(unit)
            .reminderRepeatValue(repeatValue).reminderRepeatUnit(unit)
            .sendLink(sendLink).notifyOnStart(notifyOnStart).levels(levels).build(), null);
        log.info("[EscalationSeeder] created default {}{} escalation policy",
            subjectType, frequencyScope == null ? "" : " " + frequencyScope);
    }

    private void seedLevels(String subjectType, String frequencyScope,
                            List<EscalationLevelRequest> legacy, List<EscalationLevelRequest> levels) {
        if (!policies.hasDefaultExact(subjectType, frequencyScope)) return;
        policies.refreshSeededLevels(subjectType, frequencyScope, legacy, levels);
    }

    private static List<EscalationLevelRequest> findingLevels() {
        return headLevels(0, 3, 7);
    }

    private static List<EscalationLevelRequest> controlLevels() {
        return headLevels(1, 2, 5);
    }

    private static List<EscalationLevelRequest> standardLevels(int l1, int l2, int l3) {
        return headLevels(l1, l2, l3);
    }

    private static List<EscalationLevelRequest> headLevels(int l1, int l2, int l3) {
        return List.of(
            level(1, l1, EscalationConstants.TARGET_UNIT_HEAD, null),
            level(2, l2, EscalationConstants.TARGET_DEPT_HEAD, null),
            level(3, l3, EscalationConstants.TARGET_ROLE, AppRole.CCO));
    }

    private static List<EscalationLevelRequest> managedFinding() {
        return List.of(
            level(1, 0, EscalationConstants.TARGET_ASSIGNEE, null),
            level(2, 3, EscalationConstants.TARGET_MANAGER, null),
            level(3, 7, EscalationConstants.TARGET_ROLE, AppRole.CCO));
    }

    private static List<EscalationLevelRequest> managedControl() {
        return List.of(
            level(1, 1, EscalationConstants.TARGET_ASSIGNEE, null),
            level(2, 2, EscalationConstants.TARGET_MANAGER, null),
            level(3, 5, EscalationConstants.TARGET_ROLE, AppRole.CCO));
    }

    private static List<EscalationLevelRequest> managedStandard(int l1, int l2, int l3) {
        return List.of(
            level(1, l1, EscalationConstants.TARGET_ASSIGNEE, null),
            level(2, l2, EscalationConstants.TARGET_MANAGER, null),
            level(3, l3, EscalationConstants.TARGET_MANAGER_OF_MANAGER, AppRole.CCO));
    }

    private static EscalationLevelRequest level(int levelNo, int afterValue, String targetType, String targetRole) {
        return EscalationLevelRequest.builder()
            .levelNo(levelNo).afterValue(afterValue).afterUnit(EscalationConstants.UNIT_DAYS)
            .targetType(targetType).targetRole(targetRole)
            .build();
    }
}
