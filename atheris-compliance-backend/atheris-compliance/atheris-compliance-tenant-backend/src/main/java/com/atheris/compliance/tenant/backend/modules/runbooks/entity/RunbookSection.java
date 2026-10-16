package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_sections")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookSection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sectionId;
    @Column(nullable = false)
    private Long versionId;
    @Column(nullable = false)
    private Integer sortOrder;
    @Column(nullable = false)
    private String sectionType;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(columnDefinition = "text")
    private String description;
}
