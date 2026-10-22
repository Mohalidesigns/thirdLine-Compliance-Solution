package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record EscalationCandidate(
    String subjectType,
    Long subjectId,
    String subjectLabel,
    Long subjectPolicyId,
    List<Person> assignees,
    Person owner,
    LocalDateTime dueAt,
    LocalDateTime approachAt,
    Long linkSubjectId,
    String linkBase,
    String category,
    Map<String, String> extraVars,
    String frequencyScope,
    Boolean gatheringReady
) {
}
