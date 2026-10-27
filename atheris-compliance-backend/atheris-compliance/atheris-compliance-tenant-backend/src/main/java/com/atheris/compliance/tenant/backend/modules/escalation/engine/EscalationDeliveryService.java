package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class EscalationDeliveryService {

    private final NotificationService notifications;
    private final EmailService email;
    private final NotificationTemplateService templates;

    public void deliver(EscalationCandidate candidate, String templateKey, String triggerType, int level,
                        List<EscalationTarget> targets, Map<String, String> baseVars, Person owner, String publicLink) {
        if (targets.isEmpty()) return;
        String severity = EscalationConstants.TRIGGER_OVERDUE.equals(triggerType)
            ? NotificationConstants.SEVERITY_HIGH
            : NotificationConstants.SEVERITY_MEDIUM;
        String internalLink = candidate.linkBase() + candidate.linkSubjectId();
        String emailLink = publicLink != null && !publicLink.isBlank() ? publicLink : internalLink;
        String absoluteLink = email.baseUrl() + emailLink;
        List<String> cc = ccTargets(candidate, owner);

        for (EscalationTarget target : targets) {
            Map<String, String> vars = new HashMap<>(baseVars);
            vars.put("recipientName", displayName(target));
            vars.put("link", emailLink);
            NotificationTemplateService.RenderedEmail rendered = templates.render(templateKey, vars);
            String summary = baseVars.getOrDefault("summary", candidate.subjectLabel());
            String subject = rendered.subject() != null ? rendered.subject() : summary;
            String body = rendered.body() != null ? rendered.body() : summary;

            if (target.role() != null) {
                notifications.notifyRoleEmailed(target.role(), candidate.category(), severity, summary, internalLink,
                    subject, body, cc);
                continue;
            }
            if (target.userId() != null) {
                notifications.notifyUser(target.userId(), candidate.category(), severity, summary, internalLink);
            }
            String to = target.email() != null && !target.email().isBlank() ? target.email() : null;
            if (to != null) {
                email.send(to, cc, subject, body, absoluteLink);
            }
        }
    }

    List<String> ccTargets(EscalationCandidate candidate, Person owner) {
        List<String> cc = new ArrayList<>();
        if (owner != null && owner.hasEmail()) cc.add(owner.email());
        List<Person> assignees = candidate.assignees() == null ? List.of() : candidate.assignees();
        for (Person p : assignees) {
            if (p.hasEmail()) cc.add(p.email());
        }
        return cc;
    }

    private String displayName(EscalationTarget target) {
        if (target.name() != null && !target.name().isBlank()) return target.name();
        if (target.email() != null) return target.email();
        if (target.role() != null) return target.role();
        return "";
    }
}
