package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

@Entity
@Table(name = "runbook_review_schedules")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookReviewSchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reviewSchedId;
    @Column(nullable = false)
    private Long runbookId;
    @Builder.Default
    private String cadence = "ANNUAL";
    @Column(nullable = false)
    private LocalDate nextReviewAt;
    private Integer reviewerUserId;
    @Builder.Default
    private String reviewerRole = "CCO";
}
