package com.atheris.compliance.tenant.backend.modules.runbooks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleDto {
    private Long scheduleId;
    private Long runbookId;
    private String frequency;
    private String timezone;
    private Integer leadDays;
    private Integer assigneeUserId;
    private String assigneeName;
    private String assigneeRole;
    private LocalDate nextRunAt;
    private LocalDate lastRunAt;
    private Boolean active;
    private Boolean skipHolidays;
}
