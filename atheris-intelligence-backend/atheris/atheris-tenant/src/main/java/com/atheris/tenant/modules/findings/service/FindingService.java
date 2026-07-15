package com.atheris.tenant.modules.findings.service;

import com.atheris.tenant.modules.controls.entity.*;
import com.atheris.tenant.modules.findings.dto.*;
import com.atheris.tenant.modules.findings.entity.Finding;
import com.atheris.tenant.modules.findings.repository.FindingRepository;
import com.atheris.tenant.modules.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class FindingService {

    private final FindingRepository repo;
    private final AuditService audit;

    public List<Finding> findAll() { return repo.findAll(); }
    public List<Finding> findOpen() { return repo.findAllOpen(); }
    public List<Finding> findByStatus(String s) { return repo.findByStatus(s); }
    public List<Finding> findOverdue() { return repo.findOverdueRemediation(LocalDate.now()); }
    public Finding findById(Long id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("Finding not found: " + id));
    }

    @Transactional
    public Finding autoRaiseFromTest(ControlTestResult test, Control control) {
        String severity = determineSeverity(test.getFailureSeverity(), control.getInherentRisk());
        int sla = slaDays(severity);
        Finding f = Finding.builder()
            .triggeredByTestId(test.getTestId())
            .triggerReason("Control test failed")
            .findingType("Control Failure")
            .severity(severity)
            .description(String.format("Control %s (%s) failed on %s. %s",
                control.getControlNumber(), control.getName(), test.getTestDate(), test.getResultDescription()))
            .rootCause(test.getFailureDetails())
            .assignedToUserId(control.getControlOwnerUserId())
            .assignedToName(control.getControlOwnerName())
            .assignedAt(Instant.now())
            .remediationDeadline(LocalDate.now().plus(sla, ChronoUnit.DAYS))
            .slaDays(sla)
            .createdByUserId(test.getTestedByUserId())
            .status("Open").build();
        Finding saved = repo.save(f);
        audit.log(test.getTestedByUserId(), "finding_auto_raised", "finding", saved.getFindingId(),
            Map.of("severity", severity));
        return saved;
    }

    @Transactional
    public Finding manualRaise(String description, String severity, String type, Integer userId) {
        Finding f = Finding.builder()
            .triggerReason("Manual discovery").findingType(type).severity(severity)
            .description(description).slaDays(slaDays(severity))
            .remediationDeadline(LocalDate.now().plus(slaDays(severity), ChronoUnit.DAYS))
            .createdByUserId(userId).status("Open").build();
        Finding saved = repo.save(f);
        audit.log(userId, "finding_raised_manually", "finding", saved.getFindingId(),
            Map.of("severity", severity));
        return saved;
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
