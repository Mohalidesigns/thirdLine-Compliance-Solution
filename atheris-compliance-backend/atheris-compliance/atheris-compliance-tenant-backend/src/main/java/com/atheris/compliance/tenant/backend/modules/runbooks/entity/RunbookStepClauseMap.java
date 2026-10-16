package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

/** Many-to-many link to a framework clause (composite primary key). */
@Entity
@Table(name = "runbook_step_clause_map")
@IdClass(RunbookStepClauseMap.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookStepClauseMap {
    @Id
    private Long stepId;
    @Id
    private Long clauseId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Long stepId;
        private Long clauseId;
    }
}
