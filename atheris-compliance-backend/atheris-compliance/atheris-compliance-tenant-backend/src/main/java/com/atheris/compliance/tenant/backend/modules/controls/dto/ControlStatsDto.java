package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ControlStatsDto {
    private long total;
    private long active;
    private long highRisk;
    private long testsDue;
    private List<String> themes;
    private List<String> owners;
}
