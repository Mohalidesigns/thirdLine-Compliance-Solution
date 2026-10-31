package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlTestLinkSentResponse;
import com.atheris.compliance.tenant.backend.modules.controls.dto.PublicControlTestView;
import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestLink;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestLinkRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.LinkTokens;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ControlTestLinkService {

    public static final String EVIDENCE_TYPE = "control_test";

    private final ControlTestLinkRepository links;
    private final ControlRepository controls;
    private final ControlTaskRepository tasks;
    private final ControlTestService testService;
    private final UserRepository users;
    private final OwnerRepository owners;
    private final EmailService email;
    private final NotificationTemplateService templates;
    private final EvidenceVaultService evidenceVault;
    private final TenantIdentityService tenantIdentity;
    private final ControlTestDetails details;
    private final AuditService audit;

    @Value("${atheris.controls.test-link-expiry-days:30}")
    private int expiryDays;

    @Value("${atheris.controls.test-link-secret:${ENCRYPTION_KEY:atheris-dev-test-link-secret}}")
    private String linkSecret;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String createTestLink(Integer controlId, Long taskId, String recipientEmail, String recipientName, Integer userId) {
        Control c = controls.findById(controlId)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + controlId));
        String raw = LinkTokens.token(linkSecret, "control-test", controlId.longValue());
        String hash = LinkTokens.sha256(raw);
        Instant expiresAt = expiry(task(taskId, c));
        ControlTestLink link = links.findByTokenHash(hash).orElse(null);
        if (link == null) {
            links.save(ControlTestLink.builder()
                .tokenHash(hash)
                .controlId(controlId)
                .taskId(taskId)
                .recipientEmail(recipientEmail)
                .recipientName(recipientName)
                .expiresAt(expiresAt)
                .createdByUserId(userId)
                .build());
        } else {
            if (recipientEmail != null && !recipientEmail.isBlank()) link.setRecipientEmail(recipientEmail);
            if (recipientName != null && !recipientName.isBlank()) link.setRecipientName(recipientName);
            if (taskId != null) link.setTaskId(taskId);
            link.setRevokedAt(null);
            if (link.getExpiresAt() == null || link.getExpiresAt().isBefore(expiresAt)) link.setExpiresAt(expiresAt);
            links.save(link);
        }
        return raw;
    }

    private ControlTask task(Long taskId, Control c) {
        if (taskId != null) {
            ControlTask t = tasks.findById(taskId).orElse(null);
            if (t != null) return t;
        }
        return currentTask(c);
    }

    private Instant expiry(ControlTask t) {
        LocalDate base = t != null && t.getDueDate() != null && t.getDueDate().isAfter(LocalDate.now())
            ? t.getDueDate() : LocalDate.now();
        return base.plusDays(expiryDays).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    public ControlTask currentTask(Control c) {
        return tasks.findByControlId(c.getControlId()).stream()
            .filter(t -> WorkflowStatus.TASK_PENDING.equals(t.getStatus())
                || WorkflowStatus.TASK_IN_PROGRESS.equals(t.getStatus())
                || WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()))
            .min(Comparator.comparing(ControlTask::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .orElse(null);
    }

    public String testerEmail(Control c) {
        if (c.getTesterUserId() != null) {
            String byUser = users.findById(c.getTesterUserId()).map(u -> u.getEmail())
                .filter(e -> e != null && !e.isBlank()).orElse(null);
            if (byUser != null) return byUser;
        }
        if (c.getTesterOwnerId() != null) {
            return owners.findById(c.getTesterOwnerId()).map(o -> o.getEmail())
                .filter(e -> e != null && !e.isBlank()).orElse(null);
        }
        return null;
    }

    public String ownerEmail(Control c) {
        if (c.getControlOwnerId() == null) return null;
        return owners.findById(c.getControlOwnerId()).map(o -> o.getEmail())
            .filter(e -> e != null && !e.isBlank()).orElse(null);
    }

    @Transactional
    public ControlTestLinkSentResponse sendTestLink(Integer controlId, User actor) {
        Control c = controls.findById(controlId)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + controlId));
        String to = testerEmail(c);
        if (to == null) {
            throw ApiException.conflict("no_tester",
                "Set the responsible person (tester) on this control before sending the test link.");
        }
        ControlTask t = currentTask(c);
        List<String> cc = new ArrayList<>();
        String owner = ownerEmail(c);
        if (owner != null && !owner.equalsIgnoreCase(to)) cc.add(owner);
        if (actor != null && actor.getEmail() != null && !actor.getEmail().isBlank()
            && !actor.getEmail().equalsIgnoreCase(to) && !cc.contains(actor.getEmail())) {
            cc.add(actor.getEmail());
        }
        String raw = createTestLink(controlId, t == null ? null : t.getTaskId(), to, c.getTesterName(),
            actor == null ? null : actor.getUserId());
        TestMail mail = sendTestRequest(c, t, to, cc, c.getTesterName(), raw);
        audit.log(actor == null ? null : actor.getUserId(), "control_test_link_sent", "control",
            controlId.longValue(), Map.of());
        return ControlTestLinkSentResponse.builder()
            .path(uploadPath(raw))
            .recipients(List.of(to))
            .cc(cc)
            .subject(mail.subject())
            .body(mail.body())
            .build();
    }

    public TestMail sendTestRequest(Control c, ControlTask t, String to, List<String> cc, String name, String raw) {
        Map<String, String> vars = details.messageVars(c, t, name);
        NotificationTemplateService.RenderedEmail rendered =
            templates.render(EscalationConstants.KEY_CONTROL_REQUEST, vars);
        String subject = rendered.subject() != null ? rendered.subject()
            : "Action required: test control " + c.getName();
        String body = rendered.body() != null ? rendered.body() : fallbackBody(c, name);
        String url = uploadUrl(raw);
        if (to != null && !to.isBlank()) email.send(to, cc, subject, body, url);
        return new TestMail(subject, email.compose(body, url));
    }

    public void sendReceipt(Control c, ControlTask t, String to, List<String> cc, String result) {
        if (to == null || to.isBlank()) return;
        Map<String, String> vars = details.messageVars(c, t, c.getTesterName());
        details.putResult(vars, result, null);
        NotificationTemplateService.RenderedEmail rendered =
            templates.render(EscalationConstants.KEY_CONTROL_DATA_RECEIPT, vars);
        if (rendered.subject() == null || rendered.body() == null) return;
        email.send(to, cc, rendered.subject(), rendered.body(), null);
    }

    private static String fallbackBody(Control c, String name) {
        StringBuilder body = new StringBuilder();
        if (name != null && !name.isBlank()) body.append("Hi ").append(name).append(",\n\n");
        body.append("Please perform the test of control \"").append(c.getName())
            .append("\" and record the result using the link below.\n");
        return body.toString();
    }

    public String uploadPath(String rawToken) {
        return "/control-test/" + rawToken;
    }

    public String uploadUrl(String rawToken) {
        return email.baseUrl() + uploadPath(rawToken);
    }

    @Transactional(readOnly = true)
    public PublicControlTestView view(String rawToken) {
        ControlTestLink link = resolve(rawToken);
        Control c = controls.findById(link.getControlId())
            .orElseThrow(() -> ApiException.notFound("Control not found"));
        ControlTask t = currentTask(c);
        ControlTestResult last = testService.getTestHistory(c.getControlId()).stream().findFirst().orElse(null);
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        boolean active = c.getStatus() == null || "Active".equalsIgnoreCase(c.getStatus());
        return PublicControlTestView.builder()
            .controlId(c.getControlId())
            .institutionName(p != null ? p.getLegalName() : "Institution")
            .controlNumber(c.getControlNumber())
            .controlName(c.getName())
            .theme(c.getTheme())
            .controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes())
            .howTested(c.getHowTested())
            .regulatoryRequirement(c.getRegulatoryRequirement())
            .frequency(c.getTestFrequency())
            .actName(c.getActName())
            .regulator(c.getActName())
            .responsiblePerson(c.getTesterName())
            .ownerName(c.getControlOwnerName())
            .dueDate(t != null ? t.getDueDate() : null)
            .lastTestDate(last != null ? last.getTestDate() : null)
            .lastTestResult(last != null ? last.getResult() : null)
            .editable(active && t != null)
            .build();
    }

    @Transactional
    public void submit(String rawToken, LocalDate testDate, String result, String notes,
                       String failureDetails, MultipartFile file) {
        ControlTestLink link = resolve(rawToken);
        Control c = controls.findById(link.getControlId())
            .orElseThrow(() -> ApiException.notFound("Control not found"));
        if (c.getStatus() != null && !"Active".equalsIgnoreCase(c.getStatus()))
            throw ApiException.conflict("control_inactive", "This control is not active.");
        ControlTask task = currentTask(c);
        if (task == null)
            throw ApiException.conflict("no_open_test", "No control test is currently scheduled.");

        RecordTestRequest req = new RecordTestRequest();
        req.setTestDate(testDate == null ? LocalDate.now() : testDate);
        req.setResult(result);
        req.setResultDescription(notes);
        req.setFailureDetails(failureDetails);
        req.setTestedByName(link.getRecipientName() != null ? link.getRecipientName() : c.getTesterName());
        ControlTestResult saved = testService.recordTestFromLink(c.getControlId(), req,
            req.getTestedByName() != null ? req.getTestedByName() : "the responsible person");

        if (file != null && !file.isEmpty()) {
            try {
                evidenceVault.upload(file, EVIDENCE_TYPE, saved.getTestId(),
                    "Test evidence " + saved.getTestDate(), null);
            } catch (Exception e) {
                throw new IllegalStateException("Failed to store the test evidence", e);
            }
        }

        link.setUseCount((link.getUseCount() == null ? 0 : link.getUseCount()) + 1);
        link.setLastUsedAt(Instant.now());
        links.save(link);

        audit.log(null, "control_test_submitted_via_link", "control", c.getControlId().longValue(),
            Map.of("testId", String.valueOf(saved.getTestId())));

        sendReceipt(c, task, link.getRecipientEmail(), ccList(ownerEmail(c), link.getRecipientEmail()), result);
    }

    static List<String> ccList(String candidate, String to) {
        if (candidate == null || candidate.isBlank()) return List.of();
        if (to != null && to.equalsIgnoreCase(candidate)) return List.of();
        return List.of(candidate);
    }

    private ControlTestLink resolve(String rawToken) {
        ControlTestLink link = links.findByTokenHash(LinkTokens.sha256(rawToken))
            .orElseThrow(() -> ApiException.notFound("This test link is not valid"));
        if (link.getRevokedAt() != null) {
            throw ApiException.gone("link_revoked", "This test link has been revoked");
        }
        if (link.getExpiresAt() != null && Instant.now().isAfter(link.getExpiresAt())) {
            throw ApiException.gone("link_expired", "This test link has expired");
        }
        return link;
    }

    public record TestMail(String subject, String body) {}
}
