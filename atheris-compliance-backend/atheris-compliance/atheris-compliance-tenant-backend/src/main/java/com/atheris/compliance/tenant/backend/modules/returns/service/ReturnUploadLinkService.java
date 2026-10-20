package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.returns.dto.PublicReturnUploadView;
import com.atheris.compliance.tenant.backend.modules.returns.dto.RecordReturnEventRequest;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnUploadLink;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnUploadLinkRepository;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
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

@Service
@Slf4j
@RequiredArgsConstructor
public class ReturnUploadLinkService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ReturnUploadLinkRepository links;
    private final RegulatoryReturnRepository returns;
    private final ReturnEventService returnEvents;
    private final UserRepository users;
    private final EmailService email;
    private final TenantIdentityService tenantIdentity;

    @Value("${atheris.returns.upload-link-expiry-days:30}")
    private int expiryDays;

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
        boolean editable = ret.getStatus() == RegulatoryReturnStatus.ACTIVE
            && ret.getEventTriggerLabel() != null && !ret.getEventTriggerLabel().isBlank()
            && ret.getEventDeadlineMode() != null && !ret.getEventDeadlineMode().isBlank();
        return PublicReturnUploadView.builder()
            .returnId(ret.getReturnId())
            .institutionName(p != null ? p.getLegalName() : "Institution")
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
