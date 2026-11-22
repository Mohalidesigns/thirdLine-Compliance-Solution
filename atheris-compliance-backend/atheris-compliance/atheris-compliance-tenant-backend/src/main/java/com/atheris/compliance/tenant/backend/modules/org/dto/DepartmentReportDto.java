package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class DepartmentReportDto {
    private String organizationName;
    private String scopeType;
    private String name;
    private String parentDepartmentName;
    private Integer obligationCount;
    private Map<String, Long> obligationsByRisk;
    private Integer controlCount;
    private Integer openFindingCount;
    private Integer overdueFindingCount;
    private Integer returnCount;
    @Builder.Default
    private List<Item> findings = List.of();
    @Builder.Default
    private List<Item> returns = List.of();

    @Data
    @Builder
    public static class Item {
        private String title;
        private String detail;
        private String status;
        private String dueDate;
    }
}
