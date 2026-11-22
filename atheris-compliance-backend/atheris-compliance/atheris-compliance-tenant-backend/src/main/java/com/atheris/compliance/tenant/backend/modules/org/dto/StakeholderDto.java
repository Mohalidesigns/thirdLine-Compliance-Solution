package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class StakeholderDto {
    private Integer stakeholderId;
    private String fullName;
    private String email;
    private Integer titleId;
    private String titleName;
    private String jobTitle;
    private Integer departmentId;
    private String departmentName;
    private Integer teamId;
    private String teamName;
    private Integer userId;
    private Boolean isActive;
    private Boolean placed;
    @Builder.Default
    private List<RoleCount> roles = List.of();

    @Data
    @Builder
    public static class RoleCount {
        private String code;
        private String name;
        private long count;
    }
}
