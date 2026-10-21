package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EscalationSubjectHandler {

    String subjectType();

    List<EscalationCandidate> findCandidates(LocalDate today);

    default void markEscalated(Long subjectId, int level) {
    }

    default Optional<String> filingLink(EscalationCandidate candidate) {
        return Optional.empty();
    }
}
