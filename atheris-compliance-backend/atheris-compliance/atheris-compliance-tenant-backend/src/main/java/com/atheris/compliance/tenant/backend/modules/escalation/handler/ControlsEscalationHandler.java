package com.atheris.compliance.tenant.backend.modules.escalation.handler;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationCandidate;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationSubjectHandler;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.Person;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class ControlsEscalationHandler implements EscalationSubjectHandler {

    private final ControlTaskRepository tasks;
    private final ControlRepository controls;
    private final UserRepository users;

    @Override
    public String subjectType() {
        return EscalationConstants.SUBJECT_CONTROL;
    }

    @Override
    @Transactional(readOnly = true)
    public List<EscalationCandidate> findCandidates(LocalDate today) {
        LocalDate from = today.minusDays(150);
        LocalDate to = today.plusDays(150);
        List<ControlTask> open = tasks.findByStatusInAndDueDateBetweenOrderByDueDateAsc(
            List.of(WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE), from, to);
        if (open.isEmpty()) return List.of();

        Set<Integer> controlIds = new HashSet<>();
        for (ControlTask t : open) controlIds.add(t.getControlId());
        Map<Integer, Control> byId = new HashMap<>();
        for (Control c : controls.findAllById(controlIds)) byId.put(c.getControlId(), c);

        List<EscalationCandidate> out = new ArrayList<>();
        for (ControlTask t : open) {
            if (t.getDueDate() == null) continue;
            Control c = byId.get(t.getControlId());
            Map<String, String> extra = new HashMap<>();
            extra.put("controlNumber", t.getControlNumber() == null ? "" : t.getControlNumber());
            extra.put("controlName", t.getControlName() == null ? "" : t.getControlName());
            extra.put("regulator", c != null && c.getActName() != null ? c.getActName() : "");
            out.add(new EscalationCandidate(
                EscalationConstants.SUBJECT_CONTROL,
                t.getTaskId(),
                label(t),
                null,
                assignees(t),
                owner(c),
                t.getDueDate().atStartOfDay(),
                null,
                c == null ? null : c.getControlId().longValue(),
                "/controls?controlId=",
                NotificationConstants.CATEGORY_CONTROLS,
                extra));
        }
        return out;
    }

    @Override
    @Transactional
    public void markEscalated(Long subjectId, int level) {
        tasks.findById(subjectId).ifPresent(task -> {
            task.setEscalationLevel(level);
            task.setEscalatedAt(Instant.now());
            tasks.save(task);
        });
    }

    private List<Person> assignees(ControlTask t) {
        if (t.getAssignedToUserId() == null) return List.of();
        User u = users.findById(t.getAssignedToUserId()).orElse(null);
        if (u == null) return List.of(new Person(t.getAssignedToName(), null, t.getAssignedToUserId()));
        return List.of(new Person(u.getFullName(), u.getEmail(), u.getUserId()));
    }

    private Person owner(Control c) {
        if (c == null || c.getControlOwnerUserId() == null) return null;
        User u = users.findById(c.getControlOwnerUserId()).orElse(null);
        return u == null ? new Person(c.getControlOwnerName(), null, c.getControlOwnerUserId())
            : new Person(u.getFullName(), u.getEmail(), u.getUserId());
    }

    private static String label(ControlTask t) {
        String name = t.getControlName() != null && !t.getControlName().isBlank()
            ? t.getControlName() : "Control " + t.getControlId();
        return t.getControlNumber() != null && !t.getControlNumber().isBlank()
            ? t.getControlNumber() + " — " + name : name;
    }
}
