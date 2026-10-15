package com.atheris.compliance.tenant.backend.modules.controls;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestService;
import com.atheris.compliance.tenant.backend.shared.util.ControlSchedule;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Startup backfill: give every control a test cadence (platform frequency, else a
 * risk-tiered default) and schedule its first scheduled-test task so the register can
 * show urgency. Each control is scheduled in its own transaction, and a single failure is
 * logged and skipped rather than aborting startup.
 */
@Component
@Order(40)
@Slf4j
@RequiredArgsConstructor
public class ControlTaskBackfill implements ApplicationRunner {

    private final ControlRepository controls;
    private final ControlTaskRepository tasks;
    private final ControlTestService testService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Control> all = controls.findAll();
            int created = 0;
            for (Control c : all) {
                try {
                    if (scheduleOne(c)) {
                        created++;
                    }
                } catch (Throwable e) {
                    log.warn("Control-test backfill skipped control {}: {}", c.getControlId(), e.getMessage());
                }
            }
            if (created > 0) {
                log.info("Control-test backfill scheduled {} task(s)", created);
            }
        } catch (Throwable e) {
            // Never block startup on a backfill.
            log.warn("Control-test backfill failed: {}", e.getMessage());
        }
    }

    private boolean scheduleOne(Control c) {
        if (c.getTestFrequencyDays() == null) {
            String frequency = (c.getTestFrequency() != null && !c.getTestFrequency().isBlank())
                ? c.getTestFrequency()
                : ControlSchedule.frequencyForRisk(c.getInherentRisk());
            Integer days = ControlSchedule.daysForFrequency(frequency);
            if (days == null) {
                return false;
            }
            c.setTestFrequency(frequency);
            c.setTestFrequencyDays(days);
            controls.save(c);
        }
        boolean hasOpen = tasks.findByControlId(c.getControlId()).stream()
            .anyMatch(t -> !WorkflowStatus.TASK_COMPLETED.equals(t.getStatus()));
        if (hasOpen) {
            return false;
        }
        testService.scheduleNextTest(c);
        return true;
    }
}