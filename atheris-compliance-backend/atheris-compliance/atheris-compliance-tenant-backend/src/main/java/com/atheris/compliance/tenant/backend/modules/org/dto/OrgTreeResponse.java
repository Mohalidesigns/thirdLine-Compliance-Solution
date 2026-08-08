package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class OrgTreeResponse {
    private List<DepartmentNode> departments;

    @Data
    @Builder
    public static class DepartmentNode {
        private DepartmentDto department;
        private List<TeamNode> teams;
    }

    @Data
    @Builder
    public static class TeamNode {
        private TeamDto team;
        private List<OwnerDto> owners;
    }
}
