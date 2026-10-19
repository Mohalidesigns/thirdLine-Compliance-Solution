package com.atheris.compliance.tenant.backend.modules.findings.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.controls.service.ResidualRisk;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingSpecification;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class FindingService {

    private final FindingRepository repo;
    private final OwnerRepository ownerRepo;
    private final ControlRepository controlRepo;
    private final ControlTestResultRepository controlTestRepo;
    private final ObligationClassificationRepository obligationClassificationRepo;
    private final AuditService audit;
    private final NotificationService notifications;
    private final EvidenceVaultService evidence;

    private static final Set<String> ALLOWED_EVIDENCE_TYPES = Set.of(
        "application/pdf", "image/png", "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    @Value("${atheris.remediation.max-file-size-mb:20}")
    private int maxFileMb;
    @Value("${atheris.remediation.max-files:5}")
    private int maxFiles;

    public Page<FindingRegisterItem> getRegisterList(
            String status, String severity, Boolean overdueOnly, Integer assignedToUserId, Pageable p) {
        var spec = FindingSpecification.withFilters(status, severity, overdueOnly, assignedToUserId);
        Page<Finding> page = repo.findAll(spec, p);
        // One query per page for the linked controls' numbers (no N+1).
        Set<Integer> controlIds = page.getContent().stream().map(Finding::getLinkedControlId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Integer, String> controlNumbers = new HashMap<>();
        if (!controlIds.isEmpty()) {
            controlRepo.findAllById(controlIds).forEach(c -> controlNumbers.put(c.getControlId(), c.getControlNumber()));
        }
        return page.map(f -> FindingRegisterItem.from(f, controlNumbers.get(f.getLinkedControlId())));
    }

    public FindingDetailResponse getDetail(Long id) {
        Finding f = repo.findById(id).orElseThrow(() -> ApiException.notFound("Finding not found: " + id));
        List<FindingDetailResponse.TimelineEvent> timeline = new ArrayList<>();
        if (f.getCreatedAt() != null) {
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getCreatedAt()).eventType("raised")
                .description("Finding raised" + (f.getTriggerReason() != null ? " (" + f.getTriggerReason() + ")" : ""))
                .build());
        }
        if (f.getAssignedAt() != null) {
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getAssignedAt()).eventType("assigned")
                .description("Assigned to " + (f.getAssignedToName() != null ? f.getAssignedToName() : "user " + f.getAssignedToUserId()))
                .build());
        }
        if (f.getRemediationSubmittedAt() != null) {
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getRemediationSubmittedAt()).eventType("remediated")
                .description("Remediation submitted" + (f.getRemediationNotes() != null ? " — " + f.getRemediationNotes() : ""))
                .build());
        }
        if (f.getSignedOffAt() != null) {
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getSignedOffAt()).eventType("closed")
                .description("Finding signed off and closed")
                .build());
        }
        timeline.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));

        long remaining = 0;
        if (f.getRemediationDeadline() != null && !WorkflowStatus.FINDING_CLOSED.equals(f.getStatus())) {
            remaining = Math.max(0, LocalDate.now().until(f.getRemediationDeadline(), ChronoUnit.DAYS));
        }

        return FindingDetailResponse.builder()
            .findingId(f.getFindingId())
            .displayId("FIND-" + String.format("%03d", f.getFindingId()))
            .externalReference(f.getExternalReference())
            .triggerReason(f.getTriggerReason()).findingType(f.getFindingType())
            .severity(f.getSeverity()).description(f.getDescription()).rootCause(f.getRootCause())
            .assignedToUserId(f.getAssignedToUserId()).assignedToName(f.getAssignedToName())
            .assignedAt(f.getAssignedAt()).status(f.getStatus())
            .remediationDeadline(f.getRemediationDeadline()).slaDays(f.getSlaDays())
            .slaRemainingDays(remaining)
            .remediationNotes(f.getRemediationNotes())
            .remediationEvidenceUrl(f.getRemediationEvidenceUrl())
            .remediationSubmittedAt(f.getRemediationSubmittedAt())
            .remediationSubmittedByUserId(f.getRemediationSubmittedByUserId())
            .remediationSubmittedViaLink(f.getRemediationSubmittedViaLink())
            .remediationSubmittedByOwnerId(f.getRemediationSubmittedByOwnerId())
            .reviewNotes(f.getReviewNotes())
            .signedOffByUserId(f.getSignedOffByUserId()).signedOffAt(f.getSignedOffAt())
            .closedAt(f.getClosedAt()).linkedObligationId(f.getLinkedObligationId())
            .linkedControlId(f.getLinkedControlId())
            .linkedControlNumber(f.getLinkedControlId() == null ? null
                : controlRepo.findById(f.getLinkedControlId()).map(Control::getControlNumber).orElse(null))
            .createdByUserId(f.getCreatedByUserId())
            .createdAt(f.getCreatedAt()).timeline(timeline).build();
    }

    public Finding findById(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Finding not found: " + id));
    }

    @Transactional
    public Finding autoRaiseFromTest(ControlTestResult test, Control control) {
        String severity = determineSeverity(test.getFailureSeverity(), control.getInherentRisk());
        int sla = slaDays(severity);
        Integer ownerId = test.getRemediationOwnerId() != null
            ? test.getRemediationOwnerId()
            : control.getControlOwnerId();
        List<Long> obligationIds = control.getLinkedObligationIds();
        Long linkedObligationId = obligationIds != null && obligationIds.size() == 1 ? obligationIds.get(0) : null;
        Finding f = Finding.builder()
            .triggeredByTestId(test.getTestId()).triggerReason("Control test failed")
            .linkedControlId(control.getControlId()).linkedObligationId(linkedObligationId)
            .findingType(WorkflowStatus.FINDING_TYPE_CONTROL_FAILURE).severity(severity)
            .description(String.format("Control %s (%s) failed on %s. %s",
                control.getControlNumber(), control.getName(), test.getTestDate(), test.getResultDescription()))
            .rootCause(test.getFailureDetails())
            .assignedToOwnerId(ownerId)
            .assignedToName(resolveOwnerName(ownerId))
            .assignedAt(ownerId != null ? Instant.now() : null)
            .remediationDeadline(LocalDate.now().plus(sla, ChronoUnit.DAYS))
            .slaDays(sla).createdByUserId(test.getTestedByUserId()).status(WorkflowStatus.FINDING_OPEN).build();
        Finding saved = repo.save(f);
        audit.log(test.getTestedByUserId(), "finding_auto_raised", "finding", saved.getFindingId(),
            Map.of("severity", severity));
        notifyOwnerOfAssignment(saved);
        return saved;
    }

    @Transactional
    public FindingRaisedResponse manualRaise(RaiseFindingRequest req, Integer userId) {
        String type = req.getFindingType();
        Integer controlId = req.getLinkedControlId();
        Long obligationId = req.getLinkedObligationId();
        if (WorkflowStatus.FINDING_TYPE_GAP.equals(type)) {
            if (obligationId == null) {
                throw ApiException.badRequest("A gap finding must be linked to an obligation");
            }
            controlId = null;
        } else if (WorkflowStatus.FINDING_TYPE_CONTROL_FAILURE.equals(type)) {
            if (controlId == null) {
                throw ApiException.badRequest("A control failure finding must be linked to a control");
            }
            if (obligationId == null) {
                obligationId = controlRepo.findById(controlId)
                    .map(Control::getLinkedObligationIds)
                    .filter(ids -> ids != null && !ids.isEmpty())
                    .map(ids -> ids.get(0)).orElse(null);
            }
        }
        int sla = slaDays(req.getSeverity());
        Finding f = Finding.builder()
            .triggerReason("Manual discovery").findingType(type)
            .severity(req.getSeverity()).description(req.getDescription())
            .rootCause(req.getRootCause())
            .linkedObligationId(obligationId)
            .linkedControlId(controlId)
            .assignedToOwnerId(req.getAssignedToOwnerId())
            .assignedToName(resolveOwnerName(req.getAssignedToOwnerId()))
            .assignedAt(req.getAssignedToOwnerId() != null ? Instant.now() : null)
            .remediationDeadline(req.getRemediationDeadline()).slaDays(sla)
            .createdByUserId(userId).status(req.getAssignedToOwnerId() != null
                ? WorkflowStatus.FINDING_IN_REMEDIATION : WorkflowStatus.FINDING_OPEN).build();
        Finding saved = repo.save(f);
        audit.log(userId, "finding_raised_manually", "finding", saved.getFindingId(),
            Map.of("severity", req.getSeverity()));
        notifyOwnerOfAssignment(saved);
        return new FindingRaisedResponse(saved.getFindingId(), saved.getStatus());
    }

    @Transactional
    public Finding assign(Long id, RaiseRemediationRequest req, Integer userId) {
        Finding f = findById(id);
        f.setAssignedToOwnerId(req.getAssignedToOwnerId());
        f.setAssignedToName(resolveOwnerName(req.getAssignedToOwnerId()));
        f.setRemediationDeadline(req.getRemediationDeadline());
        f.setStatus(WorkflowStatus.FINDING_IN_REMEDIATION);
        f.setAssignedAt(Instant.now());
        audit.log(userId, "finding_assigned", "finding", id, Map.of());
        Finding saved = repo.save(f);
        notifyOwnerOfAssignment(saved);
        return saved;
    }

    private String resolveOwnerName(Integer ownerId) {
        if (ownerId == null) {
            return null;
        }
        return ownerRepo.findById(ownerId)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + ownerId))
            .getFullName();
    }

    private void notifyOwnerOfAssignment(Finding f) {
        if (f.getAssignedToOwnerId() == null) {
            return;
        }
        ownerRepo.findById(f.getAssignedToOwnerId()).ifPresent(o -> {
            String summary = "Finding #" + f.getFindingId() + " (" + f.getSeverity() + ") needs remediation"
                + (f.getRemediationDeadline() != null ? " by " + f.getRemediationDeadline() : "");
            if (o.getUserId() != null) {
                notifications.notifyUserEmailed(o.getUserId(), NotificationConstants.CATEGORY_FINDINGS, NotificationConstants.SEVERITY_HIGH,
                    summary, "/findings", "Action required: finding remediation");
            } else {
                // No login — email the owner directly; the analyst will share the remediation link.
                log.info("Finding {} assigned to owner {} with no user login (email {})",
                    f.getFindingId(), o.getOwnerId(), o.getEmail());
            }
        });
    }

    @Transactional
    public Finding submitRemediation(Long id, String notes, List<MultipartFile> files, Integer userId) throws Exception {
        Finding f = findById(id);
        if (!WorkflowStatus.FINDING_IN_REMEDIATION.equals(f.getStatus())
                && !WorkflowStatus.FINDING_OPEN.equals(f.getStatus())) {
            throw ApiException.conflict("invalid_transition",
                "Remediation can only be submitted while a finding is Open or In Remediation");
        }

        List<MultipartFile> uploads = files == null ? List.of()
            : files.stream().filter(x -> x != null && !x.isEmpty()).toList();
        if (uploads.size() > maxFiles) {
            throw ApiException.badRequest("Too many files (max " + maxFiles + ")");
        }
        for (MultipartFile file : uploads) {
            if (file.getSize() > (long) maxFileMb * 1024 * 1024) {
                throw ApiException.badRequest("File too large (max " + maxFileMb + " MB): " + file.getOriginalFilename());
            }
            String type = file.getContentType();
            if (type == null || !ALLOWED_EVIDENCE_TYPES.contains(type)) {
                throw ApiException.badRequest("Unsupported file type: " + file.getOriginalFilename());
            }
            EvidenceFile saved = evidence.upload(file, "finding", f.getFindingId(),
                "Remediation evidence (recorded by analyst)", userId);
            if (f.getRemediationEvidenceUrl() == null) {
                f.setRemediationEvidenceUrl("/api/v1/evidence/" + saved.getFileId() + "/download");
            }
        }

        f.setRemediationNotes(notes);
        f.setRemediationSubmittedAt(Instant.now());
        f.setRemediationSubmittedByUserId(userId);
        f.setRemediationSubmittedViaLink(false);
        f.setStatus(WorkflowStatus.FINDING_REMEDIATED);
        audit.log(userId, "remediation_submitted", "finding", id, Map.of());

        notifications.notifyRoleEmailed(AppRole.ANALYST, NotificationConstants.CATEGORY_FINDINGS, NotificationConstants.SEVERITY_MEDIUM,
            "Finding #" + id + " remediation submitted — awaiting your review",
            "/findings", "Remediation submitted — review required");
        return repo.save(f);
    }

    @Transactional
    public Finding reviewRemediation(Long id, String decision, String notes, User reviewer) {
        Finding f = findById(id);
        if (!WorkflowStatus.FINDING_REMEDIATED.equals(f.getStatus())) {
            throw ApiException.conflict("invalid_transition", "Finding must be Remediated before review");
        }
        if (f.getRemediationSubmittedByUserId() != null
                && f.getRemediationSubmittedByUserId().equals(reviewer.getUserId())) {
            throw ApiException.conflict("self_review",
                "You cannot approve a remediation you submitted yourself");
        }

        if (WorkflowStatus.REVIEW_ACCEPTED.equals(decision)) {
            if (WorkflowStatus.FINDING_TYPE_GAP.equals(f.getFindingType()) && !gapResolved(f)) {
                throw ApiException.conflict("gap_open",
                    "Link a control to this obligation before closing the gap finding");
            }
            f.setStatus(WorkflowStatus.FINDING_CLOSED);
            f.setClosedAt(Instant.now());
            f.setSignedOffByUserId(reviewer.getUserId());
            f.setSignedOffAt(Instant.now());
            reEvaluateControlResidualRisk(f);
            audit.log(reviewer.getUserId(), "finding_signed_off", "finding", id, Map.of());
        } else if (WorkflowStatus.REVIEW_REJECTED.equals(decision)) {
            if (notes == null || notes.isBlank()) {
                throw ApiException.badRequest("A reason is required when rejecting remediation");
            }
            f.setStatus(WorkflowStatus.FINDING_IN_REMEDIATION);
            f.setReviewNotes(notes);
            audit.log(reviewer.getUserId(), "finding_rejected", "finding", id, Map.of("reason", notes));
            // Tell the owner it needs more work; their link still works.
            if (f.getAssignedToOwnerId() != null) {
                ownerRepo.findById(f.getAssignedToOwnerId()).ifPresent(o -> {
                    if (o.getUserId() != null) {
                        notifications.notifyUserEmailed(o.getUserId(), NotificationConstants.CATEGORY_FINDINGS, NotificationConstants.SEVERITY_MEDIUM,
                            "Remediation for finding #" + id + " was rejected: " + notes,
                            "/findings", "Remediation rejected — action required");
                    }
                });
            }
        } else {
            throw ApiException.badRequest("Decision must be " + WorkflowStatus.REVIEW_ACCEPTED
                + " or " + WorkflowStatus.REVIEW_REJECTED);
        }
        return repo.save(f);
    }

    /**
     * Closing a finding re-evaluates the control's residual risk. While the control still has an
     * open finding the failed test stands (residual = inherent); once the last finding is closed the
     * remediation is treated as effective and residual reverts to Low, never above inherent risk.
     */
    private void reEvaluateControlResidualRisk(Finding f) {
        if (f.getLinkedControlId() == null) {
            return;
        }
        Integer controlId = f.getLinkedControlId();
        controlRepo.findById(controlId).ifPresent(control -> {
            boolean otherOpen = repo.findByLinkedControlIdOrderByFindingIdDesc(controlId).stream()
                .filter(x -> !x.getFindingId().equals(f.getFindingId()))
                .anyMatch(x -> !WorkflowStatus.FINDING_CLOSED.equals(x.getStatus()));
            String risk = otherOpen
                ? controlTestRepo.findTopByControlIdOrderByTestDateDesc(controlId)
                    .map(t -> ResidualRisk.fromTestResult(t.getResult(), control.getInherentRisk())).orElse(null)
                : ResidualRisk.capAtInherent(WorkflowStatus.RISK_LOW, control.getInherentRisk());
            if (risk != null && !risk.equals(control.getResidualRisk())) {
                control.setResidualRisk(risk);
                controlRepo.save(control);
            }
        });
    }

    /**
     * A gap finding is resolved once its obligation is covered by at least one control.
     * Closing a gap finding before that would clear nothing on the register.
     */
    private boolean gapResolved(Finding f) {
        if (f.getLinkedObligationId() == null) {
            return false;
        }
        return obligationClassificationRepo.findByObligationId(f.getLinkedObligationId())
            .map(c -> c.getLinkedControlIds() != null && !c.getLinkedControlIds().isEmpty())
            .orElse(false);
    }

    public FindingStatsDto getStats() {
        List<Finding> all = repo.findAll();
        LocalDate today = LocalDate.now();
        List<String> openStatuses = List.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION);
        List<String> highSeverities = List.of(WorkflowStatus.RISK_CRITICAL, WorkflowStatus.RISK_HIGH);

        Map<String, Long> bySeverity = all.stream()
            .collect(Collectors.groupingBy(f -> f.getSeverity() != null ? f.getSeverity() : "Unknown", Collectors.counting()));
        Map<String, Long> byStatus = all.stream()
            .collect(Collectors.groupingBy(f -> f.getStatus() != null ? f.getStatus() : "Unknown", Collectors.counting()));

        List<Finding> open = all.stream().filter(f -> openStatuses.contains(f.getStatus())).toList();
        long overdue = open.stream()
            .filter(f -> f.getRemediationDeadline() != null && f.getRemediationDeadline().isBefore(today)).count();

        List<FindingStatsDto.Bucket> bySeverityOpen = open.stream()
            .collect(Collectors.groupingBy(f -> f.getSeverity() != null ? f.getSeverity() : "Unknown", Collectors.counting()))
            .entrySet().stream()
            .map(e -> FindingStatsDto.Bucket.builder().key(e.getKey()).count(e.getValue()).build())
            .sorted(Comparator.comparingLong(FindingStatsDto.Bucket::getCount).reversed())
            .toList();

        return FindingStatsDto.builder()
            .total(all.size())
            .open(open.size())
            .highSeverity(open.stream().filter(f -> highSeverities.contains(f.getSeverity())).count())
            .overdueRemediation(overdue)
            .closed(all.stream().filter(f -> f.getClosedAt() != null).count())
            .bySeverity(bySeverity)
            .byStatus(byStatus)
            .bySeverityOpen(bySeverityOpen)
            .build();
    }

    private String determineSeverity(String testSev, String inherent) {
        if (WorkflowStatus.RISK_HIGH.equals(testSev) || WorkflowStatus.RISK_HIGH.equals(inherent)) {
            return WorkflowStatus.RISK_HIGH;
        }
        if (WorkflowStatus.RISK_MEDIUM.equals(testSev) || WorkflowStatus.RISK_MEDIUM.equals(inherent)) {
            return WorkflowStatus.RISK_MEDIUM;
        }
        return WorkflowStatus.RISK_LOW;
    }

    public static int slaDays(String severity) {
        return switch (severity) {
            case WorkflowStatus.RISK_CRITICAL -> 1;
            case WorkflowStatus.RISK_HIGH -> 14;
            case WorkflowStatus.RISK_MEDIUM -> 30;
            default -> 60;
        };
    }
}