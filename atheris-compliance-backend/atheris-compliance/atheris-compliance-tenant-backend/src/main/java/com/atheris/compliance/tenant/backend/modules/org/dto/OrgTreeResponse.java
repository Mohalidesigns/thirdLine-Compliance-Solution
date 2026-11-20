package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class OrgTreeResponse {
    private String organizationName;
    private List<DepartmentNode> departments;
    /** Platform users (role-holders added via onboarding/invites). */
    @Builder.Default
    private List<UserNode> users = List.of();
    /** Owners with no department and no team. */
    @Builder.Default
    private List<OwnerDto> unassignedOwners = List.of();

    @Data
    @Builder
    public static class DepartmentNode {
        private DepartmentDto department;
        private List<TeamNode> teams;
        /** Owners attached to the department directly (no team). */
        @Builder.Default
        private List<OwnerDto> owners = List.of();
    }

    @Data
    @Builder
    public static class TeamNode {
        private TeamDto team;
        private List<OwnerDto> owners;
    }

    @Data
    @Builder
    public static class UserNode {
        private Integer userId;
        private String fullName;
        private String email;
        private String jobTitle;
        private String role;
        private String department;
        private Boolean isActive;
    }
}
