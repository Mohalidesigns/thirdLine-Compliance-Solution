package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

@Entity
@Table(name = "runbook_schedules")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookSchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long scheduleId;
    @Column(nullable = false)
    private Long runbookId;
    @Column(nullable = false)
    private String frequency;
    private String cronExpr;
    @Builder.Default
    private String timezone = "Africa/Lagos";
    @Builder.Default
    private Integer leadDays = 5;
    private Integer assigneeUserId;
    private String assigneeRole;
    private LocalDate anchorDate;
    private LocalDate nextRunAt;
    private LocalDate lastRunAt;
    @Builder.Default
    private Boolean isActive = true;
    @Builder.Default
    private Boolean skipHolidays = true;
}
