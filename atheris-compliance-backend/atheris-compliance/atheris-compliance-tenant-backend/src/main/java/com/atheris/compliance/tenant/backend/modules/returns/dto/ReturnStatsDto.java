package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ReturnStatsDto {
    private long total;
    private long overdue;
    private long inProgress;
    private long submitted;
    private List<String> frequencies;
    private List<String> regulators;
}
