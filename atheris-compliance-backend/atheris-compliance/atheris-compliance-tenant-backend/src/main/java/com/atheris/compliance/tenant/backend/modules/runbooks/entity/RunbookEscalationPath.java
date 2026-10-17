package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_escalation_paths")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookEscalationPath {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long escalationId;
    @Column(nullable = false)
    private Long versionId;
    @Column(nullable = false)
    private Integer level;
    @Column(nullable = false)
    private String triggerType;
    private String notifyRole;
    private Integer notifyUserId;
    @Builder.Default
    private String notifyChannel = "IN_APP";
    @Builder.Default
    private Integer waitMinutes = 0;
    @Column(columnDefinition = "text")
    private String instructions;
}
