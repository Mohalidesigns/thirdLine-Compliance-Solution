package com.atheris.compliance.tenant.backend.modules.findings.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingSpecification;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class FindingService {

    private final FindingRepository repo;
    private final OwnerRepository ownerRepo;
    private final ControlRepository controlRepo;
    private final AuditService audit;

    public Page<FindingRegisterItem> getRegisterList(
            String status, String severity, Boolean overdueOnly, Integer assignedToUserId, Pageable p) {
        var spec = FindingSpecification.withFilters(status, severity, overdueOnly, assignedToUserId);
        Page<Finding> page = repo.findAll(spec, p);
        // One query per page for the linked controls' numbers (no N+1).
        Set<Integer> controlIds = page.getContent().stream().map(Finding::getLinkedControlId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Integer, String> controlNumbers = new HashMap<>();
        if (!controlIds.isEmpty())
            controlRepo.findAllById(controlIds).forEach(c -> controlNumbers.put(c.getControlId(), c.getControlNumber()));
        return page.map(f -> FindingRegisterItem.from(f, controlNumbers.get(f.getLinkedControlId())));
    }

    /** KPI counts for the Findings page — one load of the (seed-sized) findings table, no N+1. */
    public FindingStatsDto getStats() {
        LocalDate today = LocalDate.now();
        List<Finding> all = repo.findAll();
        Map<String, Long> bySeverity = new LinkedHashMap<>();
        for (String sev : List.of("Critical", "High", "Medium", "Low")) bySeverity.put(sev, 0L);
        long open = 0, inRem = 0, remediated = 0, closed = 0, overdue = 0, critHigh = 0;
        for (Finding f : all) {
            String st = f.getStatus();
            if ("Open".equals(st)) open++;
            else if ("In Remediation".equals(st)) inRem++;
            else if ("Remediated".equals(st)) remediated++;
            else if ("Closed".equals(st)) closed++;
            // Same definition as the register's overdueOnly filter (FindingSpecification).
            if (f.getRemediationDeadline() != null && f.getRemediationDeadline().isBefore(today)
                    && !"Remediated".equals(st) && !"Closed".equals(st)) overdue++;
            String sev = f.getSeverity();
            if (("Critical".equals(sev) || "High".equals(sev)) && !"Closed".equals(st)) critHigh++;
            if (sev != null) bySeverity.merge(sev, 1L, Long::sum);
        }
        return FindingStatsDto.builder()
            .total(all.size()).open(open).inRemediation(inRem).remediated(remediated).closed(closed)
            .overdue(overdue).criticalHigh(critHigh).bySeverity(bySeverity)
            .build();
    }

    public FindingDetailResponse getDetail(Long id) {
        Finding f = repo.findById(id).orElseThrow(() -> ApiException.notFound("Finding not found: " + id));
        List<FindingDetailResponse.TimelineEvent> timeline = new ArrayList<>();
        if (f.getCreatedAt() != null)
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getCreatedAt()).eventType("raised")
                .description("Finding raised" + (f.getTriggerReason() != null ? " (" + f.getTriggerReason() + ")" : ""))
                .build());
        if (f.getAssignedAt() != null)
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getAssignedAt()).eventType("assigned")
                .description("Assigned to " + (f.getAssignedToName() != null ? f.getAssignedToName() : "user " + f.getAssignedToUserId()))
                .build());
        if (f.getRemediationSubmittedAt() != null)
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getRemediationSubmittedAt()).eventType("remediated")
                .description("Remediation submitted" + (f.getRemediationNotes() != null ? " — " + f.getRemediationNotes() : ""))
                .build());
        if (f.getCcoSignOffAt() != null)
            timeline.add(FindingDetailResponse.TimelineEvent.builder()
                .timestamp(f.getCcoSignOffAt()).eventType("closed")
                .description("Finding closed by CCO sign-off")
                .build());
        timeline.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));

        long remaining = 0;
        if (f.getRemediationDeadline() != null && !"Closed".equals(f.getStatus())) {
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
            .ccoSignOffUserId(f.getCcoSignOffUserId()).ccoSignOffAt(f.getCcoSignOffAt())
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
        Finding f = Finding.builder()
            .triggeredByTestId(test.getTestId()).triggerReason("Control test failed")
            .findingType("Control Failure").severity(severity)
            .description(String.format("Control %s (%s) failed on %s. %s",
                control.getControlNumber(), control.getName(), test.getTestDate(), test.getResultDescription()))
            .rootCause(test.getFailureDetails())
            .assignedToOwnerId(ownerId)
            .assignedToName(resolveOwnerName(ownerId))
            .assignedAt(ownerId != null ? Instant.now() : null)
            .remediationDeadline(LocalDate.now().plus(sla, ChronoUnit.DAYS))
            .slaDays(sla).createdByUserId(test.getTestedByUserId()).status("Open").build();
        Finding saved = repo.save(f);
        audit.log(test.getTestedByUserId(), "finding_auto_raised", "finding", saved.getFindingId(),
            Map.of("severity", severity));
        return saved;
    }

    @Transactional
    public FindingRaisedResponse manualRaise(RaiseFindingRequest req, Integer userId) {
        int sla = slaDays(req.getSeverity());
        Finding f = Finding.builder()
            .triggerReason("Manual discovery").findingType(req.getFindingType())
            .severity(req.getSeverity()).description(req.getDescription())
            .rootCause(req.getRootCause())
            .linkedObligationId(req.getLinkedObligationId())
            .linkedControlId(req.getLinkedControlId())
            .assignedToOwnerId(req.getAssignedToOwnerId())
            .assignedToName(resolveOwnerName(req.getAssignedToOwnerId()))
            .assignedAt(req.getAssignedToOwnerId() != null ? Instant.now() : null)
            .remediationDeadline(req.getRemediationDeadline()).slaDays(sla)
            .createdByUserId(userId).status(req.getAssignedToOwnerId() != null ? "In Remediation" : "Open").build();
        Finding saved = repo.save(f);
        audit.log(userId, "finding_raised_manually", "finding", saved.getFindingId(),
            Map.of("severity", req.getSeverity()));
        return new FindingRaisedResponse(saved.getFindingId(), saved.getStatus());
    }

    @Transactional
    public Finding assign(Long id, RaiseRemediationRequest req, Integer userId) {
        Finding f = findById(id);
        f.setAssignedToOwnerId(req.getAssignedToOwnerId());
        f.setAssignedToName(resolveOwnerName(req.getAssignedToOwnerId()));
        f.setRemediationDeadline(req.getRemediationDeadline());
        f.setStatus("In Remediation");
        f.setAssignedAt(Instant.now());
        audit.log(userId, "finding_assigned", "finding", id, Map.of());
        return repo.save(f);
    }

    private String resolveOwnerName(Integer ownerId) {
        if (ownerId == null) return null;
        return ownerRepo.findById(ownerId)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + ownerId))
            .getFullName();
    }

    @Transactional
    public Finding submitRemediation(Long id, SubmitRemediationRequest req, Integer userId) {
        Finding f = findById(id);
        f.setRemediationNotes(req.getRemediationNotes());
        f.setRemediationEvidenceUrl(req.getEvidenceUrl());
        f.setRemediationSubmittedAt(Instant.now());
        f.setStatus("Remediated");
        audit.log(userId, "remediation_submitted", "finding", id, Map.of());
        return repo.save(f);
    }

    @Transactional
    public Finding close(Long id, Integer ccoUserId) {
        Finding f = findById(id);
        if (!"Remediated".equals(f.getStatus()))
            throw ApiException.conflict("invalid_transition", "Finding must be Remediated before closing");
        f.setStatus("Closed");
        f.setCcoSignOffUserId(ccoUserId);
        f.setCcoSignOffAt(Instant.now());
        f.setClosedAt(Instant.now());
        audit.log(ccoUserId, "finding_closed", "finding", id, Map.of());
        return repo.save(f);
    }

    private String determineSeverity(String testSev, String inherent) {
        if ("High".equals(testSev) || "High".equals(inherent)) return "High";
        if ("Medium".equals(testSev) || "Medium".equals(inherent)) return "Medium";
        return "Low";
    }

    /** Remediation SLA in days per severity; shared with the findings bulk import. */
    public static int slaDays(String severity) {
        return switch (severity) {
            case "Critical" -> 1;
            case "High" -> 14;
            case "Medium" -> 30;
            default -> 60;
        };
    }
}
