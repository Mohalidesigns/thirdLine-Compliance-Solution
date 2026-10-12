package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One cleaned control point — the individual control statements a CRMP control cell decomposes
 * into. Mirrors the obligation point shape so the same renderer can display it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ControlPoint {
    private String marker;
    private String text;
    private String content;
    private String pointType;
    private Integer level;

    @Builder.Default
    private List<ControlPoint> children = List.of();
}
