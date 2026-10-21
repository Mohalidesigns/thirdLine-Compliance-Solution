package com.atheris.compliance.tenant.backend.modules.escalation.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "escalation_instance_levels")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalationInstanceLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long levelId;

    @Column(nullable = false)
    private Long overrideId;

    @Column(nullable = false)
    private Integer levelNo;

    @Builder.Default
    private Integer afterValue = 0;

    @Builder.Default
    @Column(length = 10)
    private String afterUnit = "DAYS";

    @Column(nullable = false, length = 25)
    private String targetType;

    @Column(length = 30)
    private String targetRole;
    private Integer targetUserId;
    private String targetName;
    private String targetEmail;
}
