package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderRole;
import com.atheris.compliance.tenant.backend.modules.org.repository.StakeholderRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(25)
@RequiredArgsConstructor
@Slf4j
public class StakeholderRoleSeeder implements ApplicationRunner {

    private final StakeholderRoleRepository roles;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seed("OWNER", "Owner", "Accountable owner of the object", true, 1);
        seed("TESTER", "Tester", "Runs the control test", true, 2);
        seed("RESPONSIBLE", "Responsible", "Responsible party or filer", true, 3);
        seed("REMEDIATION_OWNER", "Remediation owner", "Owns the remediation of a finding", true, 4);
        seed("VERIFIER", "Verifier", "Independently verifies or checks", false, 5);
        seed("APPROVER", "Approver", "Approves or signs off", false, 6);
        seed("WATCHER", "Watcher", "Follows the object", false, 7);
        seed("CONTRIBUTOR", "Contributor", "Contributes input or evidence", false, 8);
    }

    private void seed(String code, String name, String description, boolean isDefault, int sortOrder) {
        if (roles.findByCode(code).isPresent()) {
            return;
        }
        roles.save(StakeholderRole.builder()
            .code(code).name(name).description(description)
            .isDefault(isDefault).isActive(true).sortOrder(sortOrder).build());
        log.info("[StakeholderRoles] seeded {}", code);
    }
}
