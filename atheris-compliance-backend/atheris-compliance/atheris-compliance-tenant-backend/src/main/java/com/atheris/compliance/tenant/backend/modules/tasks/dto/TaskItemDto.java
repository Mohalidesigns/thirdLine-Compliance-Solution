package com.atheris.compliance.tenant.backend.modules.tasks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.Map;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskItemDto {
    private Long id;
    private String key;
    private String type;
    private String category;
    private String title;
    private String caption;
    private String priority;
    private String severity;
    private LocalDate dueDate;
    private Integer daysRemaining;
    private String ownerName;
    private Integer ownerUserId;
    private String stage;
    private Integer escalationLevel;
    private String linkPath;
    private String actionLabel;
    private String actionType;
    @Builder.Default
    private Map<String, Object> sourceRef = Map.of();
}
