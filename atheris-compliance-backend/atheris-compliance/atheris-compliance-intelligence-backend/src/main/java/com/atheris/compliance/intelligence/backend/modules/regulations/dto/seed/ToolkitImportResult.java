package com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Typed result of the toolkit seed import. Carries either the success counts
 * (error null) or the failure message + partial counts (error set). Serializes
 * to the same JSON shape as the legacy Map result, so the controller contract is
 * unchanged.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolkitImportResult {

    private int regulators;
    private int acts;
    private int instruments;
    private int obligations;
    private int sanctions;
    private int returns;
    private int controls;
    private int controlsDeduplicated;
    private int unmappedSources;
    private List<String> unmappedList;

    private String error;
    private String cause;
}
