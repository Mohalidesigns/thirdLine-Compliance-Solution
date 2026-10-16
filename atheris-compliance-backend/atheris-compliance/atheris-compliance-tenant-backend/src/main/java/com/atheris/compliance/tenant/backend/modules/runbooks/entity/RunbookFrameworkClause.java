package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_framework_clauses")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookFrameworkClause {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long clauseId;
    @Column(nullable = false)
    private Integer frameworkId;
    @Column(nullable = false)
    private String clauseRef;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(columnDefinition = "text")
    private String requirementText;
    private String domain;
    @Column(columnDefinition = "text")
    private String deadlineRule;
    private Integer slaMinutes;
}
