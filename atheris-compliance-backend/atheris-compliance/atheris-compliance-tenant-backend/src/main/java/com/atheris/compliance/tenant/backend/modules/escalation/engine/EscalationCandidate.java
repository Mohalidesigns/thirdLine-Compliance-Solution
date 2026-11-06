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
    boolean started,
    boolean remindable,
    List<String> extraCcEmails
) {
    public EscalationCandidate(String subjectType, Long subjectId, String subjectLabel, Long subjectPolicyId,
                               List<Person> assignees, Person owner, LocalDateTime dueAt, LocalDateTime approachAt,
                               Long linkSubjectId, String linkBase, String category, Map<String, String> extraVars,
                               String frequencyScope, boolean started) {
        this(subjectType, subjectId, subjectLabel, subjectPolicyId, assignees, owner, dueAt, approachAt,
            linkSubjectId, linkBase, category, extraVars, frequencyScope, started, true, List.of());
    }

    public EscalationCandidate(String subjectType, Long subjectId, String subjectLabel, Long subjectPolicyId,
                               List<Person> assignees, Person owner, LocalDateTime dueAt, LocalDateTime approachAt,
                               Long linkSubjectId, String linkBase, String category, Map<String, String> extraVars,
                               String frequencyScope, boolean started, boolean remindable) {
        this(subjectType, subjectId, subjectLabel, subjectPolicyId, assignees, owner, dueAt, approachAt,
            linkSubjectId, linkBase, category, extraVars, frequencyScope, started, remindable, List.of());
    }
}
