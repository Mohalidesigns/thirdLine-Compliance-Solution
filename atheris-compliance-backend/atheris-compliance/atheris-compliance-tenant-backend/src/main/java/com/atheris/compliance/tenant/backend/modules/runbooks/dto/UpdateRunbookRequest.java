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
public class UpdateRunbookRequest {
    private String title;
    private String category;
    private String criticality;
    private Integer ownerUserId;
    private String frequency;
    private Integer slaMinutes;
    private String objective;
    @Builder.Default
    private List<String> scopeSystems = new ArrayList<>();
    @Builder.Default
    private List<String> scopeTeams = new ArrayList<>();
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    private String reviewCadence;
}
