package com.atheris.compliance.tenant.backend.modules.remediation.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.remediation.dto.PublicRemediationView;
import com.atheris.compliance.tenant.backend.modules.remediation.entity.RemediationLink;
import com.atheris.compliance.tenant.backend.modules.remediation.repository.RemediationLinkRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
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
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class RemediationLinkService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "application/pdf", "image/png", "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final RemediationLinkRepository links;
    private final FindingRepository findings;
    private final ControlRepository controls;
    private final OwnerRepository owners;
    private final EvidenceVaultService evidence;
    private final NotificationService notifications;
    private final AuditService audit;
    private final EmailService email;
    private final TenantIdentityService tenantIdentity;

    @Value("${atheris.remediation.link-expiry-grace-days:7}")
    private int graceDays;
    @Value("${atheris.remediation.max-file-size-mb:20}")
    private int maxFileMb;
    @Value("${atheris.remediation.max-files:5}")
    private int maxFiles;

    /** Create a link for a finding and return the raw token (shown once). */
    @Transactional
    public String createLink(Long findingId, Integer userId) {
        Finding f = findings.findById(findingId)
            .orElseThrow(() -> ApiException.notFound("Finding not found: " + findingId));
        if (WorkflowStatus.FINDING_CLOSED.equals(f.getStatus()))
            throw ApiException.conflict("finding_closed", "This finding is already closed");

        String raw = randomToken();
        LocalDate base = f.getRemediationDeadline() != null ? f.getRemediationDeadline() : LocalDate.now();
        String ownerEmail = ownerEmail(f);
        RemediationLink link = RemediationLink.builder()
            .tokenHash(sha256(raw))
            .findingId(findingId)
            .ownerId(f.getAssignedToOwnerId())
            .ownerEmail(ownerEmail)
            .expiresAt(base.plusDays(graceDays).atStartOfDay(java.time.ZoneOffset.UTC).toInstant())
            .createdByUserId(userId)
            .build();
        links.save(link);
        audit.log(userId, "remediation_link_created", "finding", findingId, Map.of());
        // Email the link straight to the owner (they need no account).
        if (ownerEmail != null) {
            email.send(ownerEmail, "Action required: remediation for finding #" + findingId,
                "You have been asked to provide remediation evidence for finding #" + findingId
                    + " (" + f.getSeverity() + ").\n"
                    + (f.getRemediationDeadline() != null ? "\nDeadline: " + f.getRemediationDeadline() + "\n" : ""),
                remediationUrl(raw));
        }
        return raw;
    }

    public String remediationUrl(String rawToken) {
        return email.baseUrl() + "/remediate/" + rawToken;
    }

    /** Email the link to the finding's owner (no login required). */
    @Transactional
    public void emailLink(Long findingId, String rawToken, Integer userId) {
        Finding f = findings.findById(findingId)
            .orElseThrow(() -> ApiException.notFound("Finding not found: " + findingId));
        String to = ownerEmail(f);
        if (to == null) { log.info("No owner email for finding {}", findingId); return; }
        email.send(to, "Action required: remediation for finding #" + findingId,
            "You have been asked to provide remediation evidence for finding #" + findingId
                + " (" + f.getSeverity() + ").\n\n"
                + (f.getRemediationDeadline() != null ? "Deadline: " + f.getRemediationDeadline() + "\n\n" : ""),
            remediationUrl(rawToken));
    }

    @Transactional
    public PublicRemediationView view(String rawToken) {
        RemediationLink link = resolve(rawToken);
        Finding f = findings.findById(link.getFindingId())
            .orElseThrow(() -> ApiException.notFound("Finding not found"));
        boolean closed = WorkflowStatus.FINDING_CLOSED.equals(f.getStatus());
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        return PublicRemediationView.builder()
            .findingId(f.getFindingId())
            .institutionName(p != null ? p.getLegalName() : "Institution")
            .description(f.getDescription())
            .findingType(f.getFindingType())
            .severity(f.getSeverity())
            .controlNumber(f.getLinkedControlId() == null ? null
                : controls.findById(f.getLinkedControlId()).map(Control::getControlNumber).orElse(null))
            .remediationDeadline(f.getRemediationDeadline())
            .status(f.getStatus())
            .ownerName(f.getAssignedToName())
            .editable(!closed)
            .build();
    }

    /** Public submission: notes + up to N evidence files. Moves the finding to Remediated. */
    @Transactional
    public void submit(String rawToken, String notes, List<MultipartFile> files) throws Exception {
        RemediationLink link = resolve(rawToken);
        Finding f = findings.findById(link.getFindingId())
            .orElseThrow(() -> ApiException.notFound("Finding not found"));
        if (WorkflowStatus.FINDING_CLOSED.equals(f.getStatus()))
            throw ApiException.conflict("finding_closed", "This finding is already closed");
        if (WorkflowStatus.FINDING_REMEDIATED.equals(f.getStatus()))
            throw ApiException.conflict("already_submitted", "Remediation has already been submitted");

        List<MultipartFile> uploads = files == null ? List.of()
            : files.stream().filter(x -> x != null && !x.isEmpty()).toList();
        if (uploads.size() > maxFiles)
            throw ApiException.badRequest("Too many files (max " + maxFiles + ")");

        for (MultipartFile file : uploads) {
            if (file.getSize() > (long) maxFileMb * 1024 * 1024)
                throw ApiException.badRequest("File too large (max " + maxFileMb + " MB): " + file.getOriginalFilename());
            String type = file.getContentType();
            if (type == null || !ALLOWED_TYPES.contains(type))
                throw ApiException.badRequest("Unsupported file type: " + file.getOriginalFilename());
            EvidenceFile saved = evidence.upload(file, "finding", f.getFindingId(),
                "Remediation evidence (via link)", null);
            if (f.getRemediationEvidenceUrl() == null)
                f.setRemediationEvidenceUrl("/api/v1/evidence/" + saved.getFileId() + "/download");
        }

        f.setRemediationNotes(notes);
        f.setRemediationSubmittedAt(Instant.now());
        f.setStatus(WorkflowStatus.FINDING_REMEDIATED);
        findings.save(f);

        link.setUseCount(link.getUseCount() + 1);
        link.setLastUsedAt(Instant.now());
        links.save(link);

        audit.log(null, "remediation_submitted_via_link", "finding", f.getFindingId(),
            Map.of("email", link.getOwnerEmail() == null ? "" : link.getOwnerEmail()));
        notifications.notifyRoleEmailed(AppRole.ANALYST, NotificationConstants.CATEGORY_FINDINGS, WorkflowStatus.RISK_MEDIUM,
            "Finding #" + f.getFindingId() + " remediation submitted via link — awaiting review",
            "/findings", "Remediation submitted — review required");
    }

    // ── helpers ──

    private RemediationLink resolve(String rawToken) {
        RemediationLink link = links.findByTokenHash(sha256(rawToken))
            .orElseThrow(() -> ApiException.notFound("This remediation link is not valid"));
        if (link.getRevokedAt() != null)
            throw ApiException.gone("link_revoked", "This remediation link has been revoked");
        if (Instant.now().isAfter(link.getExpiresAt()))
            throw ApiException.gone("link_expired", "This remediation link has expired");
        return link;
    }

    private String ownerEmail(Finding f) {
        if (f.getAssignedToOwnerId() == null) return null;
        return owners.findById(f.getAssignedToOwnerId())
            .map(Owner::getEmail).filter(e -> e != null && !e.isBlank()).orElse(null);
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