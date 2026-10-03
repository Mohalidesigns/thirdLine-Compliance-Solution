package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides which filing instances can be regenerated after a schedule change. Shared by the frequency/due-date
 * repair and the schedule edit so both keep exactly the same instances.
 */
@Component
@RequiredArgsConstructor
public class UntouchedInstances {

    /** Evidence {@code source_type} values that point at a filing instance id. */
    private static final List<String> INSTANCE_EVIDENCE_TYPES = List.of("return_instance", "return_filing_instance");

    private final EvidenceFileRepository evidence;

    /** The untouched subset of {@code insts} (one evidence query for all of them). */
    public List<ReturnFilingInstance> removable(List<ReturnFilingInstance> insts) {
        Set<Long> withEvidence = withEvidence(insts);
        return insts.stream().filter(i -> isUntouched(i, withEvidence)).toList();
    }

    /** Ids among {@code insts} that have an evidence file attached. */
    public Set<Long> withEvidence(List<ReturnFilingInstance> insts) {
        if (insts.isEmpty()) return Set.of();
        Set<Long> ids = insts.stream().map(ReturnFilingInstance::getInstanceId).collect(Collectors.toSet());
        return evidence.findBySourceTypeInAndSourceIdIn(INSTANCE_EVIDENCE_TYPES, ids).stream()
            .map(EvidenceFile::getSourceId).collect(Collectors.toSet());
    }

    /**
     * An instance is untouched when nothing a user can write has been written to it:
     * status Not Started, stage Not Started, no stage owner, no stage data (advance/submit history),
     * no submitted date / submitter / submission evidence URL, no notes, no days-late figure, and no
     * evidence file attached to it ({@code evidence_files.source_type} return_instance). The system-written
     * escalation fields ({@code escalation_level}, {@code escalated_at}) and {@code filing_channel}
     * (copied from the return at creation) are ignored.
     */
    public static boolean isUntouched(ReturnFilingInstance i, Set<Long> withEvidence) {
        return (i.getStatus() == null || i.getStatus() == ReturnFilingStatus.NOT_STARTED)
            && (i.getCurrentStage() == null || i.getCurrentStage() == ReturnStage.NOT_STARTED)
            && i.getStageOwnerUserId() == null
            && isBlankJson(i.getStageData())
            && i.getSubmittedDate() == null
            && i.getSubmittedByUserId() == null
            && isBlank(i.getSubmissionEvidenceUrl())
            && isBlank(i.getNotes())
            && (i.getDaysLate() == null || i.getDaysLate() == 0)
            && !withEvidence.contains(i.getInstanceId());
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static boolean isBlankJson(String s) {
        if (s == null) return true;
        String t = s.replaceAll("\\s+", "");
        return t.isEmpty() || t.equals("{}") || t.equals("null");
    }
}
