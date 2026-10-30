package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;

/** One "tests due" rule for the Controls page and the dashboard (they used to disagree: 0 vs 6). */
public final class ControlTaskRules {

    public static final Set<String> OPEN_TASK_STATUS = Set.of(
        WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE);
    public static final int TESTS_DUE_WINDOW_DAYS = 30;

    private ControlTaskRules() {}

    public static boolean isOpen(ControlTask t) {
        return t.getStatus() != null && OPEN_TASK_STATUS.contains(t.getStatus()) && t.getDueDate() != null;
    }

    /** Open test tasks due within the next 30 days (overdue ones included). */
    public static int testsDue(Collection<ControlTask> tasks, LocalDate today) {
        LocalDate until = today.plusDays(TESTS_DUE_WINDOW_DAYS);
        return (int) tasks.stream().filter(ControlTaskRules::isOpen).filter(t -> !t.getDueDate().isAfter(until)).count();
    }
}
