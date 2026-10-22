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
                10, 2, true, standardLevels(0, 3, 7));
            seed(EscalationConstants.SUBJECT_RETURN, "DAILY", "Daily Return Escalation",
                0, 1, true, standardLevels(0, 1, 2));
            seed(EscalationConstants.SUBJECT_RETURN, "WEEKLY", "Weekly Return Escalation",
                2, 1, true, standardLevels(0, 2, 4));
            seed(EscalationConstants.SUBJECT_RETURN, "MONTHLY", "Monthly Return Escalation",
                10, 2, true, standardLevels(0, 3, 7));
            seed(EscalationConstants.SUBJECT_RETURN, "QUARTERLY", "Quarterly Return Escalation",
                15, 3, true, standardLevels(0, 5, 10));
            seed(EscalationConstants.SUBJECT_RETURN, "SEMI_ANNUAL", "Semi-Annual Return Escalation",
                21, 5, true, standardLevels(0, 7, 14));
            seed(EscalationConstants.SUBJECT_RETURN, "ANNUAL", "Annual Return Escalation",
                30, 7, true, standardLevels(0, 7, 14));
            seed(EscalationConstants.SUBJECT_RETURN, "BIENNIAL", "Biennial Return Escalation",
                30, 7, true, standardLevels(0, 7, 14));
            seed(EscalationConstants.SUBJECT_CONTROL, null, "Standard Control Test Escalation",
                5, 2, false, List.of(
                    level(1, 0, EscalationConstants.TARGET_ASSIGNEE, null),
                    level(2, 2, EscalationConstants.TARGET_MANAGER, null),
                    level(3, 5, EscalationConstants.TARGET_ROLE, AppRole.CCO)));
        } catch (Throwable e) {
            log.error("[EscalationSeeder] failed: {}", e.getMessage(), e);
        }
    }

    private void seed(String subjectType, String frequencyScope, String name, int startValue, int repeatValue,
                      boolean sendLink, List<EscalationLevelRequest> levels) {
        if (policies.defaultPolicy(subjectType, frequencyScope).isPresent()) return;
        policies.create(EscalationPolicyRequest.builder()
            .name(name).subjectType(subjectType).frequencyScope(frequencyScope).isDefault(true).isActive(true)
            .reminderStartValue(startValue).reminderStartUnit(EscalationConstants.UNIT_DAYS)
            .reminderRepeatValue(repeatValue).reminderRepeatUnit(EscalationConstants.UNIT_DAYS)
            .sendLink(sendLink).levels(levels).build(), null);
        log.info("[EscalationSeeder] created default {}{} escalation policy",
            subjectType, frequencyScope == null ? "" : " " + frequencyScope);
    }

    private static List<EscalationLevelRequest> standardLevels(int l1, int l2, int l3) {
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
