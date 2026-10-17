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
public class TemplateDetailDto {
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
    private List<String> clauseRefs = new ArrayList<>();
    private Boolean adopted;
    private Long adoptedRunbookId;
    private Integer adoptedTemplateVersion;
    private Boolean updateAvailable;
    private Instant updatedAt;
    private Map<String,Object> content;
}
