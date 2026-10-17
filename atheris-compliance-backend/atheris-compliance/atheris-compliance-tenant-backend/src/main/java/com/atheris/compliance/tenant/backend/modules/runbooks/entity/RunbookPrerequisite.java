package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_prerequisites")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookPrerequisite {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long prereqId;
    @Column(nullable = false)
    private Long versionId;
    @Builder.Default
    private Integer sortOrder = 0;
    @Column(nullable = false)
    private String prereqType;
    @Column(nullable = false, columnDefinition = "text")
    private String label;
    @Column(columnDefinition = "text")
    private String detail;
    @Builder.Default
    private Boolean isMandatory = true;
}
