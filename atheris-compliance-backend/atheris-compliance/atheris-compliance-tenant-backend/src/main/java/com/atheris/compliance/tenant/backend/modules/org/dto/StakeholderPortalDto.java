package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class StakeholderPortalDto {
    private String fullName;
    private String departmentName;
    private String teamName;
    @Builder.Default
    private List<Item> items = List.of();

    @Data
    @Builder
    public static class Item {
        private String role;
        private String subjectType;
        private Long subjectId;
        private String title;
        private String detail;
        private String dueDate;
    }
}
