package com.atheris.compliance.tenant.backend.modules.escalation.handler;

import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationCandidate;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationSubjectHandler;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.Person;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingDetails;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.remediation.service.RemediationLinkService;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@Slf4j
@RequiredArgsConstructor
public class FindingEscalationHandler implements EscalationSubjectHandler {

    private final FindingRepository findings;
    private final OwnerRepository owners;
    private final FindingDetails details;
    private final RemediationLinkService remediationLinks;

    @Override
    public String subjectType() {
        return EscalationConstants.SUBJECT_FINDING;
    }

    @Override
    @Transactional(readOnly = true)
    public List<EscalationCandidate> findCandidates(LocalDate today) {
        List<Finding> open = findings.findByStatusInAndRemediationDeadlineBetweenOrderByRemediationDeadlineAsc(
            List.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION),
            today.minusDays(150), today.plusDays(150));
        List<EscalationCandidate> out = new ArrayList<>();
        for (Finding f : open) {
            Owner owner = f.getAssignedToOwnerId() == null ? null
                : owners.findById(f.getAssignedToOwnerId()).orElse(null);
            List<Person> assignees = new ArrayList<>();
            if (owner != null) {
                assignees.add(new Person(owner.getFullName(), owner.getEmail(), owner.getUserId()));
            } else if (f.getAssignedToName() != null) {
                assignees.add(new Person(f.getAssignedToName(), null, null));
            }
            Map<String, String> extra = details.detailVars(f);
            out.add(new EscalationCandidate(
                EscalationConstants.SUBJECT_FINDING,
                f.getFindingId(),
                label(f),
                null,
                assignees,
                null,
                LocalDateTime.of(f.getRemediationDeadline(), java.time.LocalTime.MIDNIGHT),
                null,
                f.getFindingId(),
                "/findings?findingId=",
                NotificationConstants.CATEGORY_FINDINGS,
                extra,
                f.getSeverity(),
                true));
        }
        return out;
    }

    @Override
    public Optional<String> filingLink(EscalationCandidate candidate) {
        if (candidate.linkSubjectId() == null) return Optional.empty();
        try {
            return Optional.ofNullable(remediationLinks.ensureLinkPath(candidate.linkSubjectId()));
        } catch (RuntimeException e) {
            log.warn("[Escalation] remediation link failed for finding {}: {}", candidate.linkSubjectId(), e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public boolean remindUnstarted() {
        return true;
    }

    private static String label(Finding f) {
        return "Finding #" + f.getFindingId()
            + (f.getSeverity() == null || f.getSeverity().isBlank() ? "" : " (" + f.getSeverity() + ")");
    }
}
