package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FindingStatsDto {
    @Builder.Default private long total = 0;
    @Builder.Default private long open = 0;              // Open + In Remediation
    @Builder.Default private long highSeverity = 0;      // Critical + High (open)
    @Builder.Default private long overdueRemediation = 0;
    @Builder.Default private long closed = 0;
    @Builder.Default private Map<String, Long> bySeverity = Map.of();
    @Builder.Default private Map<String, Long> byStatus = Map.of();
    @Builder.Default private List<Bucket> bySeverityOpen = List.of();

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Bucket {
        private String key;
        private long count;
    }
}