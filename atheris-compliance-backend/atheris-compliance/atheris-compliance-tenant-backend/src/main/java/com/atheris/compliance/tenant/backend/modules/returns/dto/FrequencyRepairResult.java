package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Outcome of applying the return frequency repair ({@code POST /api/v1/returns/frequency-repair}). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FrequencyRepairResult {
    private int retyped;
    private int instancesRemoved;
    private int instancesKept;
    private int instancesCreated;
}
