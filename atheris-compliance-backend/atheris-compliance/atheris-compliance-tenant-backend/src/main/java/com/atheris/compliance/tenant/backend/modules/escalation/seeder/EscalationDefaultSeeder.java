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
            seed(EscalationConstants.SUBJECT_RETURN, "Standard Return Escalation",
                10, EscalationConstants.UNIT_DAYS, 2, EscalationConstants.UNIT_DAYS, true,
                List.of(
                    level(1, 0, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_ASSIGNEE, null),
                    level(2, 3, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_MANAGER, null),
                    level(3, 7, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_MANAGER_OF_MANAGER, AppRole.CCO)));
            seed(EscalationConstants.SUBJECT_CONTROL, "Standard Control Test Escalation",
                5, EscalationConstants.UNIT_DAYS, 2, EscalationConstants.UNIT_DAYS, false,
                List.of(
                    level(1, 0, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_ASSIGNEE, null),
                    level(2, 2, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_MANAGER, null),
                    level(3, 5, EscalationConstants.UNIT_DAYS, EscalationConstants.TARGET_ROLE, AppRole.CCO)));
        } catch (Throwable e) {
            log.error("[EscalationSeeder] failed: {}", e.getMessage(), e);
        }
    }

    private void seed(String subjectType, String name, Integer startValue, String startUnit,
                      Integer repeatValue, String repeatUnit, boolean sendLink,
                      List<EscalationLevelRequest> levels) {
        if (policies.defaultPolicy(subjectType).isPresent()) return;
        policies.create(EscalationPolicyRequest.builder()
            .name(name).subjectType(subjectType).isDefault(true).isActive(true)
            .reminderStartValue(startValue).reminderStartUnit(startUnit)
            .reminderRepeatValue(repeatValue).reminderRepeatUnit(repeatUnit)
            .sendLink(sendLink).levels(levels).build(), null);
        log.info("[EscalationSeeder] created default {} escalation policy", subjectType);
    }

    private static EscalationLevelRequest level(int levelNo, int afterValue, String afterUnit,
                                                String targetType, String targetRole) {
        return EscalationLevelRequest.builder()
            .levelNo(levelNo).afterValue(afterValue).afterUnit(afterUnit)
            .targetType(targetType).targetRole(targetRole)
            .build();
    }
}
