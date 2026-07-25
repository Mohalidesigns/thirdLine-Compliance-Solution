package com.atheris.compliance.tenant.backend.modules.findings.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingSpecification;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class FindingService {

    private final FindingRepository repo;
    private final AuditService audit;

    public Page<FindingRegisterItem> getRegisterList(
            String status, String severity, Boolean overdueOnly, Integer assignedToUserId, Pageable p) {
        var spec = FindingSpecification.withFilters(status, severity, overdueOnly, assignedToUserId);
        return repo.findAll(spec, p).map(FindingRegisterItem::from);
    }

    public FindingDetailResponse getDetail(Long id) {
        Finding f = repo.findById(id).orElseThrow(() -> new RuntimeException("Finding not found: " + id));
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
            .linkedControlId(f.getLinkedControlId()).createdByUserId(f.getCreatedByUserId())
            .createdAt(f.getCreatedAt()).timeline(timeline).build();
    }

    public Finding findById(Long id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("Finding not found: " + id));
    }

    @Transactional
    public Finding autoRaiseFromTest(ControlTestResult test, Control control) {
        String severity = determineSeverity(test.getFailureSeverity(), control.getInherentRisk());
        int sla = slaDays(severity);
        Finding f = Finding.builder()
            .triggeredByTestId(test.getTestId()).triggerReason("Control test failed")
            .findingType("Control Failure").severity(severity)
            .description(String.format("Control %s (%s) failed on %s. %s",
                control.getControlNumber(), control.getName(), test.getTestDate(), test.getResultDescription()))
            .rootCause(test.getFailureDetails())
            .assignedToUserId(control.getControlOwnerUserId())
            .assignedToName(control.getControlOwnerName())
            .assignedAt(Instant.now())
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
            .assignedToUserId(req.getAssignedToUserId())
            .assignedToName(req.getAssignedToName())
            .assignedAt(req.getAssignedToUserId() != null ? Instant.now() : null)
            .remediationDeadline(req.getRemediationDeadline()).slaDays(sla)
            .createdByUserId(userId).status(req.getAssignedToUserId() != null ? "In Remediation" : "Open").build();
        Finding saved = repo.save(f);
        audit.log(userId, "finding_raised_manually", "finding", saved.getFindingId(),
            Map.of("severity", req.getSeverity()));
        return new FindingRaisedResponse(saved.getFindingId(), saved.getStatus());
    }

    @Transactional
    public Finding assign(Long id, RaiseRemediationRequest req, Integer userId) {
        Finding f = findById(id);
        f.setAssignedToUserId(req.getAssignedToUserId());
        f.setRemediationDeadline(req.getRemediationDeadline());
        f.setStatus("In Remediation");
        f.setAssignedAt(Instant.now());
        audit.log(userId, "finding_assigned", "finding", id, Map.of());
        return repo.save(f);
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
            throw new RuntimeException("Finding must be Remediated before closing");
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

    private int slaDays(String severity) {
        return switch (severity) {
            case "Critical" -> 1;
            case "High" -> 14;
            case "Medium" -> 30;
            default -> 60;
        };
    }
}
