package com.atheris.compliance.tenant.backend.modules.controls;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestService;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Order(40)
@Slf4j
@RequiredArgsConstructor
public class ControlTaskBackfill implements ApplicationRunner {

    private final ControlRepository controls;
    private final ControlTaskRepository tasks;
    private final ControlTestService testService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            List<Control> all = controls.findAll();
            int created = 0;
            for (Control c : all) {
                if (c.getTestFrequencyDays() == null) {
                    continue;
                }
                boolean hasOpen = tasks.findByControlId(c.getControlId()).stream()
                    .anyMatch(t -> !WorkflowStatus.TASK_COMPLETED.equals(t.getStatus()));
                if (hasOpen) {
                    continue;
                }
                testService.scheduleNextTest(c);
                created++;
            }
            if (created > 0) {
                log.info("Control-test backfill scheduled {} task(s)", created);
            }
        } catch (Throwable e) {
            // Never block startup on a backfill.
            log.warn("Control-test backfill failed: {}", e.getMessage());
        }
    }
}