package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "obligation_points")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationPoint {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long obligationId;
    private Long parentId;
    private Integer sortOrder;
    private String marker;
    @Builder.Default private Integer level = 0;
    @Column(columnDefinition = "text") private String content;
    @Builder.Default private String pointType = "verbatim";
    @Builder.Default private Instant createdAt = Instant.now();
}
