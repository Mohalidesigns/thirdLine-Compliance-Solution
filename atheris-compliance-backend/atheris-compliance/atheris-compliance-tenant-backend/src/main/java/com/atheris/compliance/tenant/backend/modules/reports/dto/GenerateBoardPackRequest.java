package com.atheris.compliance.tenant.backend.modules.reports.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateBoardPackRequest {
    @NotNull
    private LocalDate periodFrom;
    @NotNull
    private LocalDate periodTo;
    /** Optional subset of sections; null/empty means all sections. */
    private List<String> sections;
}