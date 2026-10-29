package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.returns.dto.PublicReturnUploadView;
import com.atheris.compliance.tenant.backend.modules.returns.dto.RecordReturnEventRequest;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnUploadLink;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnUploadLinkRepository;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReturnUploadLinkService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ReturnUploadLinkRepository links;
    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final ReturnEventService returnEvents;
    private final ReturnService returnService;
    private final EvidenceVaultService evidenceVault;
    private final UserRepository users;
    private final EmailService email;
    private final TenantIdentityService tenantIdentity;
    private final NotificationTemplateService templates;
    private final ReturnFilingDetails details;

    @Value("${atheris.returns.upload-link-expiry-days:30}")
    private int expiryDays;

    @Value("${atheris.returns.upload-link-secret:${ENCRYPTION_KEY:atheris-dev-upload-link-secret}}")
    private String linkSecret;

    @Transactional
    public String createLink(Long returnId, String recipientEmail, String recipientName, Integer userId) {
        RegulatoryReturn ret = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        requireEventDriven(ret);
        String to = recipientEmail != null && !recipientEmail.isBlank() ? recipientEmail.trim() : defaultOwnerEmail(ret);
        String name = recipientName != null && !recipientName.isBlank() ? recipientName.trim() : ret.getReturnOwnerName();
        String raw = randomToken();
        links.save(ReturnUploadLink.builder()
            .tokenHash(sha256(raw))
            .returnId(returnId)
            .recipientEmail(to)
            .recipientName(name)
            .expiresAt(LocalDate.now().plusDays(expiryDays).atStartOfDay(ZoneOffset.UTC).toInstant())
            .createdByUserId(userId)
            .build());
        if (to != null) {
            email.send(to, "Action required: record an event filing for " + ret.getReturnName(),
                "You have been asked to record an event filing for the return \"" + ret.getReturnName() + "\""
                    + (ret.getEventTriggerLabel() != null ? " (trigger: " + ret.getEventTriggerLabel() + ")" : "")
                    + ".\n",
                uploadUrl(raw));
        }
        return raw;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public String createFilingLink(Long returnId, Long instanceId, String recipientEmail, String recipientName, Integer userId) {
        RegulatoryReturn ret = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        if (ret.getStatus() != RegulatoryReturnStatus.ACTIVE)
            throw ApiException.conflict("return_inactive", "This return is inactive.");
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Filing not found: " + instanceId));
        if (!returnId.equals(inst.getReturnId()))
            throw ApiException.badRequest("invalid_filing", "Filing does not belong to this return.");
        String raw = FilingLinkTokens.token(linkSecret, instanceId);
        String hash = sha256(raw);
        Instant expiresAt = filingExpiry(inst);
        ReturnUploadLink link = links.findByTokenHash(hash).orElse(null);
        if (link == null) {
            links.save(ReturnUploadLink.builder()
                .tokenHash(hash)
                .returnId(returnId)
                .instanceId(instanceId)
                .recipientEmail(recipientEmail)
                .recipientName(recipientName)
                .expiresAt(expiresAt)
                .createdByUserId(userId)
                .build());
        } else {
            if (recipientEmail != null && !recipientEmail.isBlank()) link.setRecipientEmail(recipientEmail);
            if (recipientName != null && !recipientName.isBlank()) link.setRecipientName(recipientName);
            link.setRevokedAt(null);
            if (link.getExpiresAt() == null || link.getExpiresAt().isBefore(expiresAt)) link.setExpiresAt(expiresAt);
            links.save(link);
        }
        return raw;
    }

    private Instant filingExpiry(ReturnFilingInstance inst) {
        LocalDate base = inst.getDueDate() != null && inst.getDueDate().isAfter(LocalDate.now())
            ? inst.getDueDate() : LocalDate.now();
        return base.plusDays(expiryDays).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    public FilingMail sendFilingRequest(RegulatoryReturn ret, ReturnFilingInstance inst, String to,
                                        List<String> cc, String name, String rawToken) {
        Map<String, String> vars = details.messageVars(ret, inst, name);
        NotificationTemplateService.RenderedEmail rendered =
            templates.render(EscalationConstants.KEY_RETURN_FILING_REQUEST, vars);
        String subject = rendered.subject() != null ? rendered.subject()
            : "Action required: filing data for " + ret.getReturnName();
        String body = rendered.body() != null ? rendered.body() : fallbackFilingBody(ret, name);
        String url = uploadUrl(rawToken);
        if (to != null && !to.isBlank()) email.send(to, cc, subject, body, url);
        return new FilingMail(subject, email.compose(body, url));
    }

    private static String fallbackFilingBody(RegulatoryReturn ret, String name) {
        StringBuilder body = new StringBuilder();
        if (name != null && !name.isBlank()) body.append("Hi ").append(name).append(",\n\n");
        body.append("Please prepare and submit the filing data for \"")
            .append(ret.getReturnName()).append("\" using the link below.\n");
        if (ret.getFilingRegulator() != null && !ret.getFilingRegulator().isBlank())
            body.append("\nRegulator: ").append(ret.getFilingRegulator()).append("\n");
        return body.toString();
    }

    public record FilingMail(String subject, String body) {}

    public void emailFilingLink(Long returnId, String to, String name, String rawToken) {
        if (to == null || to.isBlank()) return;
        RegulatoryReturn ret = returns.findById(returnId).orElse(null);
        String returnName = ret != null ? ret.getReturnName() : "the return";
        email.send(to, "Action required: filing data for " + returnName,
            "The compliance team reviewed the submission for \"" + returnName
                + "\" and requested changes. Please resubmit the filing data using the link below.\n",
            uploadUrl(rawToken));
    }

    /** Relative path the client resolves against {@code window.location.origin}. */
    public String uploadPath(String rawToken) {
        return "/return-upload/" + rawToken;
    }

    /** Absolute URL for emails — points at the tenant portal (configured base-url). */
    public String uploadUrl(String rawToken) {
        return email.baseUrl() + uploadPath(rawToken);
    }

    @Transactional(readOnly = true)
    public PublicReturnUploadView view(String rawToken) {
        ReturnUploadLink link = resolve(rawToken);
        RegulatoryReturn ret = returns.findById(link.getReturnId())
            .orElseThrow(() -> ApiException.notFound("Return not found"));
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        if (link.getInstanceId() != null) {
            ReturnFilingInstance inst = instances.findById(link.getInstanceId()).orElse(null);
            boolean editable = ret.getStatus() == RegulatoryReturnStatus.ACTIVE && inst != null
                && !inst.isPendingReview()
                && (inst.getCurrentStage() == ReturnStage.NOT_STARTED
                    || inst.getCurrentStage() == ReturnStage.DATA_GATHERING)
                && returnService.isFilingOpenForData(inst.getInstanceId());
            return PublicReturnUploadView.builder()
                .returnId(ret.getReturnId())
                .institutionName(p != null ? p.getLegalName() : "Institution")
                .mode("FILING")
                .instanceId(inst != null ? inst.getInstanceId() : null)
                .period(inst != null ? inst.getPeriod() : null)
                .dueDate(inst != null ? inst.getDueDate() : null)
                .status(inst != null && inst.getStatus() != null ? inst.getStatus().db() : null)
                .returnName(ret.getReturnName())
                .regulator(ret.getFilingRegulator())
                .actName(ret.getActName())
                .frequency(ret.getFrequency())
                .frequencyType(ret.getFrequencyType())
                .deadlineText(ret.getDeadlineText())
                .responsibleUnit(ret.getResponsibleUnit())
                .responsiblePerson(ret.getResponsiblePerson())
                .ownerName(ret.getReturnOwnerName())
                .editable(editable)
                .build();
        }
        boolean editable = ret.getStatus() == RegulatoryReturnStatus.ACTIVE
            && ret.getEventTriggerLabel() != null && !ret.getEventTriggerLabel().isBlank()
            && ret.getEventDeadlineMode() != null && !ret.getEventDeadlineMode().isBlank();
        return PublicReturnUploadView.builder()
            .returnId(ret.getReturnId())
            .institutionName(p != null ? p.getLegalName() : "Institution")
            .mode("EVENT")
            .returnName(ret.getReturnName())
            .regulator(ret.getFilingRegulator())
            .actName(ret.getActName())
            .frequency(ret.getFrequency())
            .frequencyType(ret.getFrequencyType())
            .triggerLabel(ret.getEventTriggerLabel())
            .deadlineMode(ret.getEventDeadlineMode())
            .deadlineDays(ret.getEventDeadlineDays())
            .deadlineUnit(ret.getEventDeadlineUnit())
            .deadlineText(ret.getDeadlineText())
            .responsibleUnit(ret.getResponsibleUnit())
            .responsiblePerson(ret.getResponsiblePerson())
            .ownerName(ret.getReturnOwnerName())
            .editable(editable)
            .build();
    }

    /**
     * Records an event filing from the public page. Attaches the uploaded file when present,
     * else stores the reference. Runs with a null user — the token is the only credential.
     */
    @Transactional
    public void submit(String rawToken, LocalDate triggerDate, String reference, LocalDate dueDate, MultipartFile file) {
        ReturnUploadLink link = resolve(rawToken);
        RegulatoryReturn ret = returns.findById(link.getReturnId())
            .orElseThrow(() -> ApiException.notFound("Return not found"));
        if (link.getInstanceId() != null) {
            submitFiling(link, reference, file);
            return;
        }
        requireEventDriven(ret);
        if (triggerDate == null) throw ApiException.badRequest("The event (trigger) date is required.");
        if (triggerDate.isAfter(LocalDate.now())) throw ApiException.badRequest("The event date cannot be in the future.");

        RecordReturnEventRequest req = new RecordReturnEventRequest();
        req.setTriggerDate(triggerDate);
        req.setDueDate(dueDate);
        req.setReference(reference);

        boolean hasFile = file != null && !file.isEmpty();
        if (hasFile) {
            returnEvents.recordUploaded(ret.getReturnId(), req, file, null);
        } else {
            if (reference == null || reference.isBlank())
                throw ApiException.badRequest("Provide an evidence reference or attach a file.");
            returnEvents.record(ret.getReturnId(), req, null);
        }

        link.setUseCount(link.getUseCount() + 1);
        link.setLastUsedAt(Instant.now());
        links.save(link);
    }

    private void submitFiling(ReturnUploadLink link, String reference, MultipartFile file) {
        ReturnFilingInstance inst = instances.findById(link.getInstanceId())
            .orElseThrow(() -> ApiException.notFound("Filing not found"));
        if (inst.getStatus() == ReturnFilingStatus.SUBMITTED || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE)
            throw ApiException.conflict("already_submitted", "This filing has already been submitted.");
        boolean hasFile = file != null && !file.isEmpty();
        String evidenceRef;
        if (hasFile) {
            try {
                EvidenceFile f = evidenceVault.upload(file, "return_instance", inst.getInstanceId(),
                    "Filing submission " + inst.getPeriod(), null);
                evidenceRef = f.getOriginalName() != null ? f.getOriginalName() : ("evidence:" + f.getFileId());
            } catch (Exception e) {
                throw new IllegalStateException("Failed to store filing evidence", e);
            }
        } else if (reference != null && !reference.isBlank()) {
            evidenceRef = reference.trim();
        } else {
            throw ApiException.badRequest("Provide the filing data: attach a file or a reference.");
        }
        returnService.submitFromLink(inst.getInstanceId(), evidenceRef,
            link.getRecipientName(), link.getRecipientEmail(), null);
        link.setUseCount((link.getUseCount() == null ? 0 : link.getUseCount()) + 1);
        link.setLastUsedAt(Instant.now());
        links.save(link);
    }

    private void requireEventDriven(RegulatoryReturn ret) {
        ReturnFrequency frequency = ReturnFrequency.fromCode(ret.getFrequencyType()).orElse(ReturnFrequency.MONTHLY);
        if (frequency != ReturnFrequency.EVENT_DRIVEN)
            throw ApiException.conflict("not_event_driven", "This return is not event-driven.");
        if (ret.getStatus() != RegulatoryReturnStatus.ACTIVE)
            throw ApiException.conflict("return_inactive", "This return is inactive.");
    }

    private String defaultOwnerEmail(RegulatoryReturn ret) {
        if (ret.getReturnOwnerUserId() == null) {
            return null;
        }
        return users.findById(ret.getReturnOwnerUserId()).map(u -> u.getEmail())
            .filter(e -> e != null && !e.isBlank()).orElse(null);
    }

    private ReturnUploadLink resolve(String rawToken) {
        ReturnUploadLink link = links.findByTokenHash(sha256(rawToken))
            .orElseThrow(() -> ApiException.notFound("This upload link is not valid"));
        if (link.getRevokedAt() != null) {
            throw ApiException.gone("link_revoked", "This upload link has been revoked");
        }
        if (Instant.now().isAfter(link.getExpiresAt())) {
            throw ApiException.gone("link_expired", "This upload link has expired");
        }
        return link;
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
