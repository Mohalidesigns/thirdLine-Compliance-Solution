package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationInstanceDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelDto;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationEvent;
import com.atheris.compliance.tenant.backend.modules.escalation.repository.EscalationEventRepository;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class EscalationEngine {

    private final List<EscalationSubjectHandler> handlers;
    private final EscalationPolicyService policies;
    private final EscalationTargetResolver resolver;
    private final EscalationDeliveryService delivery;
    private final EscalationEventRepository events;
    private final AuditService audit;

    @Autowired
    @Lazy
    private EscalationEngine self;

    @Scheduled(fixedDelayString = "${atheris.escalation.tick-ms:300000}",
        initialDelayString = "${atheris.escalation.initial-delay-ms:90000}")
    public void tick() {
        LocalDate today = LocalDate.now();
        for (EscalationSubjectHandler handler : handlers) {
            List<EscalationCandidate> candidates;
            try {
                candidates = handler.findCandidates(today);
            } catch (Throwable e) {
                log.warn("[Escalation] {} scan failed: {}", handler.subjectType(), e.getMessage());
                continue;
            }
            for (EscalationCandidate candidate : candidates) {
                try {
                    self.process(candidate, today);
                } catch (Throwable e) {
                    log.warn("[Escalation] {}#{} failed: {}", candidate.subjectType(), candidate.subjectId(), e.getMessage());
                }
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void process(EscalationCandidate candidate, LocalDate today) {
        EscalationInstanceDto config = policies.resolve(candidate.subjectType(), candidate.subjectId(),
            candidate.subjectPolicyId(), candidate.frequencyScope());
        if (config == null || Boolean.FALSE.equals(config.getActive())) return;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = candidate.dueAt();

        if (Boolean.TRUE.equals(config.getNotifyOnStart())
            && Boolean.TRUE.equals(candidate.gatheringReady())
            && !fired(candidate, EscalationConstants.TRIGGER_GATHERING, 0)) {
            fire(candidate, null, EscalationConstants.TRIGGER_GATHERING, 0, now, Boolean.TRUE.equals(config.getSendLink()));
        }

        LocalDateTime approachAt = approachAt(candidate, config);
        if (candidate.started() && approachAt != null && now.isBefore(dueAt) && !now.isBefore(approachAt)) {
            boolean sendLink = Boolean.TRUE.equals(config.getSendLink());
            if (!fired(candidate, EscalationConstants.TRIGGER_APPROACHING, 0)) {
                fire(candidate, null, EscalationConstants.TRIGGER_APPROACHING, 0, now, sendLink);
            }
            Integer repeat = config.getReminderRepeatValue();
            if (repeat != null && repeat > 0) {
                reminderIfDue(candidate, approachAt, now, repeat, config.getReminderRepeatUnit(), sendLink);
            }
        }

        for (EscalationLevelDto level : config.getLevels() == null ? List.<EscalationLevelDto>of() : config.getLevels()) {
            if (level.getLevelNo() == null) continue;
            LocalDateTime target = dueAt.plus(level.getAfterValue() == null ? 0 : level.getAfterValue(), unit(level.getAfterUnit()));
            if (!now.isBefore(target) && !fired(candidate, EscalationConstants.TRIGGER_OVERDUE, level.getLevelNo())) {
                fire(candidate, level, EscalationConstants.TRIGGER_OVERDUE, level.getLevelNo(), now, false);
                handlerFor(candidate.subjectType()).ifPresent(h -> h.markEscalated(candidate.subjectId(), level.getLevelNo()));
            }
        }
    }

    private LocalDateTime approachAt(EscalationCandidate candidate, EscalationInstanceDto config) {
        if (candidate.approachAt() != null) return candidate.approachAt();
        if (config.getReminderStartValue() != null) {
            return candidate.dueAt().minus(config.getReminderStartValue(), unit(config.getReminderStartUnit()));
        }
        return null;
    }

    private void reminderIfDue(EscalationCandidate candidate, LocalDateTime approachAt, LocalDateTime now,
                               int repeat, String repeatUnit, boolean sendLink) {
        EscalationEvent last = events
            .findBySubjectTypeAndSubjectIdAndTriggerTypeAndLevel(candidate.subjectType(), candidate.subjectId(),
                EscalationConstants.TRIGGER_REMINDER, 0)
            .orElse(null);
        LocalDateTime base = last == null ? approachAt
            : LocalDateTime.ofInstant(last.getFiredAt(), ZoneId.systemDefault());
        if (!now.isBefore(base.plus(repeat, unit(repeatUnit)))) {
            fire(candidate, null, EscalationConstants.TRIGGER_REMINDER, 0, now, sendLink);
        }
    }

    private void fire(EscalationCandidate candidate, EscalationLevelDto level, String trigger, int levelNo,
                      LocalDateTime now, boolean includePublicLink) {
        List<EscalationTarget> targets = level == null
            ? resolver.assigneeTargets(candidate.assignees(), candidate.owner())
            : resolver.resolve(level, candidate.assignees(), candidate.owner());
        if (targets.isEmpty()) return;

        String publicLink = includePublicLink
            ? handlerFor(candidate.subjectType()).flatMap(h -> h.filingLink(candidate)).orElse(null)
            : null;
        String templateKey = templateKey(candidate, trigger);
        Map<String, String> vars = baseVars(candidate, trigger, levelNo);
        delivery.deliver(candidate, templateKey, trigger, levelNo, targets, vars, candidate.owner(), publicLink);

        EscalationEvent event = events
            .findBySubjectTypeAndSubjectIdAndTriggerTypeAndLevel(candidate.subjectType(), candidate.subjectId(), trigger, levelNo)
            .orElseGet(() -> EscalationEvent.builder()
                .subjectType(candidate.subjectType()).subjectId(candidate.subjectId())
                .triggerType(trigger).level(levelNo).build());
        event.setSubjectLabel(candidate.subjectLabel());
        event.setTemplateKey(templateKey);
        event.setChannel(EscalationConstants.CHANNEL_EMAIL);
        event.setFiredAt(now.atZone(ZoneId.systemDefault()).toInstant());
        events.save(event);

        audit.log(null, "escalation_sent", candidate.subjectType().toLowerCase(Locale.ROOT), candidate.subjectId(),
            Map.of("trigger", trigger, "level", levelNo, "targets", targets.size()));
    }

    private boolean fired(EscalationCandidate candidate, String trigger, int level) {
        return events.existsBySubjectTypeAndSubjectIdAndTriggerTypeAndLevel(
            candidate.subjectType(), candidate.subjectId(), trigger, level);
    }

    private Optional<EscalationSubjectHandler> handlerFor(String subjectType) {
        return handlers.stream().filter(h -> h.subjectType().equals(subjectType)).findFirst();
    }

    private String templateKey(EscalationCandidate candidate, String trigger) {
        if (EscalationConstants.TRIGGER_GATHERING.equals(trigger)) return EscalationConstants.KEY_RETURN_GATHERING;
        boolean control = EscalationConstants.SUBJECT_CONTROL.equals(candidate.subjectType());
        if (EscalationConstants.TRIGGER_OVERDUE.equals(trigger)) {
            return control ? EscalationConstants.KEY_CONTROL_OVERDUE : EscalationConstants.KEY_RETURN_OVERDUE;
        }
        if (EscalationConstants.TRIGGER_APPROACHING.equals(trigger)) {
            return control ? EscalationConstants.KEY_CONTROL_APPROACHING : EscalationConstants.KEY_RETURN_APPROACHING;
        }
        return control ? EscalationConstants.KEY_CONTROL_APPROACHING : EscalationConstants.KEY_RETURN_REMINDER;
    }

    private Map<String, String> baseVars(EscalationCandidate candidate, String trigger, int level) {
        Map<String, String> vars = new HashMap<>(candidate.extraVars());
        String label = candidate.subjectLabel();
        vars.put("subject", label);
        vars.put("returnName", label);
        vars.put("controlName", label);
        vars.put("dueDate", candidate.dueAt().toLocalDate().toString());
        vars.put("level", String.valueOf(level));
        vars.put("daysLeft", String.valueOf(Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), candidate.dueAt().toLocalDate()))));
        vars.put("daysLate", String.valueOf(Math.max(0, ChronoUnit.DAYS.between(candidate.dueAt().toLocalDate(), LocalDate.now()))));
        vars.put("summary", EscalationConstants.TRIGGER_OVERDUE.equals(trigger)
            ? label + " is overdue (L" + level + ")"
            : "Upcoming: " + label);
        return vars;
    }

    private static ChronoUnit unit(String unit) {
        return EscalationConstants.UNIT_HOURS.equalsIgnoreCase(unit == null ? "" : unit)
            ? ChronoUnit.HOURS : ChronoUnit.DAYS;
    }
}
