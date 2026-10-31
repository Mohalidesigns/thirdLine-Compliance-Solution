package com.atheris.compliance.tenant.backend.modules.escalation.handler;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestLinkService;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
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
    private final OwnerRepository owners;
    private final ControlTestLinkService testLinks;

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
            extra.put("controlName", c != null && c.getName() != null ? c.getName()
                : (t.getControlName() == null ? "" : t.getControlName()));
            extra.put("regulator", c != null && c.getActName() != null ? c.getActName() : "");
            extra.put("actName", c != null && c.getActName() != null ? c.getActName() : "");
            extra.put("responsiblePerson", c != null && c.getTesterName() != null ? c.getTesterName() : "");
            extra.put("ownerName", c != null && c.getControlOwnerName() != null ? c.getControlOwnerName() : "");
            extra.put("testFrequency", c != null && c.getTestFrequency() != null ? c.getTestFrequency() : "");
            out.add(new EscalationCandidate(
                EscalationConstants.SUBJECT_CONTROL,
                t.getTaskId(),
                label(t),
                null,
                assignees(t, c),
                owner(c),
                t.getDueDate().atStartOfDay(),
                null,
                c == null ? null : c.getControlId().longValue(),
                "/controls?controlId=",
                NotificationConstants.CATEGORY_CONTROLS,
                extra,
                null,
                true));
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

    private List<Person> assignees(ControlTask t, Control c) {
        if (t.getAssignedToUserId() != null) {
            User u = users.findById(t.getAssignedToUserId()).orElse(null);
            return List.of(u == null ? new Person(t.getAssignedToName(), null, t.getAssignedToUserId())
                : new Person(u.getFullName(), u.getEmail(), u.getUserId()));
        }
        if (c == null) return List.of();
        String testerEmail = testLinks.testerEmail(c);
        if (testerEmail == null && c.getTesterUserId() == null) return List.of();
        return List.of(new Person(c.getTesterName(), testerEmail, c.getTesterUserId()));
    }

    private Person owner(Control c) {
        if (c == null) return null;
        if (c.getControlOwnerUserId() != null) {
            User u = users.findById(c.getControlOwnerUserId()).orElse(null);
            if (u != null) return new Person(u.getFullName(), u.getEmail(), u.getUserId());
            return new Person(c.getControlOwnerName(), null, c.getControlOwnerUserId());
        }
        if (c.getControlOwnerId() == null) return null;
        return owners.findById(c.getControlOwnerId())
            .map(o -> new Person(o.getFullName(), o.getEmail(), o.getUserId()))
            .orElse(null);
    }

    @Override
    public Optional<String> filingLink(EscalationCandidate candidate) {
        if (candidate.linkSubjectId() == null) return Optional.empty();
        Control c = controls.findById(candidate.linkSubjectId().intValue()).orElse(null);
        if (c == null) return Optional.empty();
        String to = testLinks.testerEmail(c);
        if (to == null) return Optional.empty();
        try {
            String raw = testLinks.createTestLink(c.getControlId(), candidate.subjectId(), to, c.getTesterName(), null);
            return Optional.of(testLinks.uploadPath(raw));
        } catch (RuntimeException e) {
            log.warn("[Escalation] control test link failed for control {}: {}", c.getControlId(), e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public boolean remindUnstarted() {
        return true;
    }

    private static String label(ControlTask t) {
        String name = t.getControlName() != null && !t.getControlName().isBlank()
            ? t.getControlName() : "Control " + t.getControlId();
        return t.getControlNumber() != null && !t.getControlNumber().isBlank()
            ? t.getControlNumber() + " — " + name : name;
    }
}
