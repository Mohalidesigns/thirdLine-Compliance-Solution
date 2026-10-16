package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "runbook_step_evidence_reqs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookStepEvidenceReq {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reqId;
    @Column(nullable = false)
    private Long stepId;
    @Column(nullable = false)
    private String evidenceType;
    @Column(nullable = false, columnDefinition = "text")
    private String label;
    @Builder.Default
    private Boolean isMandatory = true;
    @Builder.Default
    private Integer retentionYears = 7;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> acceptedMime = new ArrayList<>();
}
