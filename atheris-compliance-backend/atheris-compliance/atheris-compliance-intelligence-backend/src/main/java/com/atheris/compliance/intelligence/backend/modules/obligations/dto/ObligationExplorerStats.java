package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ObligationExplorerStats {
    private long total;
    private long highRisk;
    private long withPoints;
    private long withoutPoints;
    @Builder.Default
    private List<String> regulators = List.of();
    @Builder.Default
    private List<String> areas = List.of();
    @Builder.Default
    private List<String> risks = List.of();
    @Builder.Default
    private List<String> acts = List.of();
}
