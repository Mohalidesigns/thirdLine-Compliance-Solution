package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "requirement_controls")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@IdClass(RequirementControl.Key.class)
public class RequirementControl {
    @Id private Long requirementId;
    @Id private Integer controlId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Long requirementId;
        private Integer controlId;
    }
}