package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Template summary (list rows) and detail (when {@code content} is set).
 * The internal tenant-facing endpoints and the admin explorer share this shape;
 * {@code content} is omitted from list responses.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunbookTemplateDto {
    private Long templateId;
    private String templateCode;
    private Integer templateVersion;
    private String title;
    private String category;
    private String criticality;
    private String frequency;
    private Integer slaMinutes;
    private String objective;
    private Integer stepCount;
    private Integer sectionCount;
    @Builder.Default
    private List<String> clauseRefs = List.of();
    private String status;
    private String contentHash;
    private Instant publishedAt;
    private Instant createdAt;
    private Instant updatedAt;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Map<String, Object> content;
}
