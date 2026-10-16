package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

/** Many-to-many link to a framework clause (composite primary key). */
@Entity
@Table(name = "runbook_clause_map")
@IdClass(RunbookClauseMap.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookClauseMap {
    @Id
    private Long runbookId;
    @Id
    private Long clauseId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Long runbookId;
        private Long clauseId;
    }
}
