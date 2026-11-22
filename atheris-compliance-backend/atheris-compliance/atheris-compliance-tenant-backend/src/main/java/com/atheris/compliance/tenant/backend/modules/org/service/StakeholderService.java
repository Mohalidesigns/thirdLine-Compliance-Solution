package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.org.dto.AssignStakeholderRequest;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderAssignmentDto;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderDto;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderRoleDto;
import com.atheris.compliance.tenant.backend.modules.org.entity.*;
import com.atheris.compliance.tenant.backend.modules.org.repository.*;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StakeholderService {

    private final OwnerRepository stakeholders;
    private final DepartmentRepository departments;
    private final TeamRepository teams;
    private final StakeholderRoleRepository roles;
    private final StakeholderAssignmentRepository assignments;
    private final ControlRepository controls;
    private final FindingRepository findings;
    private final ObligationClassificationRepository classifications;
    private final PlacementService placement;
    private final StakeholderTitleService titleService;

    @Transactional(readOnly = true)
    public List<StakeholderDto> list(Integer departmentId, Integer teamId, String q) {
        Map<Integer, String> deptNames = departments.findAll().stream()
            .collect(Collectors.toMap(Department::getDepartmentId, Department::getName));
        Map<Integer, String> teamNames = teams.findAll().stream()
            .collect(Collectors.toMap(Team::getTeamId, Team::getName));

        Map<Integer, Long> controlOwner = new HashMap<>();
        Map<Integer, Long> tester = new HashMap<>();
        for (Control c : controls.findAll()) {
            if (c.getControlOwnerId() != null) controlOwner.merge(c.getControlOwnerId(), 1L, Long::sum);
            if (c.getTesterOwnerId() != null) tester.merge(c.getTesterOwnerId(), 1L, Long::sum);
        }
        Map<Integer, Long> findingOwner = new HashMap<>();
        for (Finding f : findings.findAll()) {
            if (f.getAssignedToOwnerId() != null) findingOwner.merge(f.getAssignedToOwnerId(), 1L, Long::sum);
        }
        Map<Integer, Long> obligationOwner = new HashMap<>();
        for (ObligationClassification c : classifications.findAll()) {
            if (c.getAssignedOwnerId() != null) obligationOwner.merge(c.getAssignedOwnerId(), 1L, Long::sum);
        }
        Map<Integer, List<StakeholderAssignment>> byStakeholder = assignments.findAll().stream()
            .collect(Collectors.groupingBy(StakeholderAssignment::getStakeholderId));
        Map<Integer, StakeholderRole> rolesById = roles.findAll().stream()
            .collect(Collectors.toMap(StakeholderRole::getRoleId, Function.identity()));

        String needle = q == null ? null : q.trim().toLowerCase();
        Map<Integer, String> titleNames = titleService.namesById();

        return stakeholders.findAll().stream()
            .filter(s -> departmentId == null || departmentId.equals(s.getDepartmentId()))
            .filter(s -> teamId == null || teamId.equals(s.getTeamId()))
            .filter(s -> needle == null || needle.isEmpty()
                || (s.getFullName() != null && s.getFullName().toLowerCase().contains(needle))
                || (s.getEmail() != null && s.getEmail().toLowerCase().contains(needle)))
            .sorted(Comparator.comparing(Owner::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(s -> toDto(s, deptNames, teamNames, titleNames,
                roleCounts(s.getOwnerId(), controlOwner, tester, findingOwner, obligationOwner,
                    byStakeholder.getOrDefault(s.getOwnerId(), List.of()), rolesById)))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<StakeholderRoleDto> listRoles() {
        return roles.findAllByOrderBySortOrderAsc().stream()
            .map(r -> StakeholderRoleDto.builder()
                .roleId(r.getRoleId()).code(r.getCode()).name(r.getName()).description(r.getDescription())
                .isDefault(r.getIsDefault()).isActive(r.getIsActive()).sortOrder(r.getSortOrder()).build())
            .toList();
    }

    @Transactional(readOnly = true)
    public List<StakeholderAssignmentDto> listAssignments(Integer stakeholderId) {
        Map<Integer, StakeholderRole> rolesById = roles.findAll().stream()
            .collect(Collectors.toMap(StakeholderRole::getRoleId, Function.identity()));
        return assignments.findByStakeholderId(stakeholderId).stream()
            .map(a -> {
                StakeholderRole r = rolesById.get(a.getRoleId());
                return StakeholderAssignmentDto.builder()
                    .assignmentId(a.getAssignmentId()).subjectType(a.getSubjectType()).subjectId(a.getSubjectId())
                    .stakeholderId(a.getStakeholderId()).roleId(a.getRoleId())
                    .roleCode(r != null ? r.getCode() : null).roleName(r != null ? r.getName() : null).build();
            })
            .toList();
    }

    @Transactional
    public StakeholderAssignmentDto assign(Integer stakeholderId, AssignStakeholderRequest req, Integer userId) {
        placement.requirePlaced(stakeholderId);
        StakeholderRole role = roles.findByCode(req.getRoleCode())
            .orElseThrow(() -> ApiException.badRequest("unknown_role", "Unknown stakeholder role: " + req.getRoleCode()));
        StakeholderAssignment saved = assignments
            .findBySubjectTypeAndSubjectIdAndStakeholderIdAndRoleId(
                req.getSubjectType(), req.getSubjectId(), stakeholderId, role.getRoleId())
            .orElseGet(() -> assignments.save(StakeholderAssignment.builder()
                .subjectType(req.getSubjectType()).subjectId(req.getSubjectId())
                .stakeholderId(stakeholderId).roleId(role.getRoleId()).createdByUserId(userId).build()));
        return StakeholderAssignmentDto.builder()
            .assignmentId(saved.getAssignmentId()).subjectType(saved.getSubjectType()).subjectId(saved.getSubjectId())
            .stakeholderId(saved.getStakeholderId()).roleId(role.getRoleId())
            .roleCode(role.getCode()).roleName(role.getName()).build();
    }

    @Transactional
    public void unassign(Long assignmentId) {
        assignments.findById(assignmentId)
            .orElseThrow(() -> ApiException.notFound("Assignment not found: " + assignmentId));
        assignments.deleteById(assignmentId);
    }

    private List<StakeholderDto.RoleCount> roleCounts(
            Integer id, Map<Integer, Long> controlOwner, Map<Integer, Long> tester,
            Map<Integer, Long> findingOwner, Map<Integer, Long> obligationOwner,
            List<StakeholderAssignment> mine, Map<Integer, StakeholderRole> rolesById) {

        Map<String, StakeholderDto.RoleCount> out = new LinkedHashMap<>();
        add(out, "OWNER", "Owner", controlOwner.getOrDefault(id, 0L));
        add(out, "TESTER", "Tester", tester.getOrDefault(id, 0L));
        add(out, "REMEDIATION_OWNER", "Remediation owner", findingOwner.getOrDefault(id, 0L));
        add(out, "RESPONSIBLE", "Responsible", obligationOwner.getOrDefault(id, 0L));
        for (StakeholderAssignment a : mine) {
            StakeholderRole r = rolesById.get(a.getRoleId());
            if (r != null) add(out, r.getCode(), r.getName(), 1L);
        }
        return out.values().stream().filter(rc -> rc.getCount() > 0).toList();
    }

    private static void add(Map<String, StakeholderDto.RoleCount> out, String code, String name, long count) {
        StakeholderDto.RoleCount existing = out.get(code);
        if (existing == null) {
            out.put(code, StakeholderDto.RoleCount.builder().code(code).name(name).count(count).build());
        } else {
            existing.setCount(existing.getCount() + count);
        }
    }

    private StakeholderDto toDto(Owner s, Map<Integer, String> deptNames, Map<Integer, String> teamNames,
                                 Map<Integer, String> titleNames, List<StakeholderDto.RoleCount> roleCounts) {
        return StakeholderDto.builder()
            .stakeholderId(s.getOwnerId()).fullName(s.getFullName()).email(s.getEmail())
            .titleId(s.getTitleId())
            .titleName(s.getTitleId() == null ? null : titleNames.get(s.getTitleId()))
            .jobTitle(s.getTitleId() == null ? null : titleNames.get(s.getTitleId()))
            .departmentId(s.getDepartmentId()).departmentName(deptNames.get(s.getDepartmentId()))
            .teamId(s.getTeamId()).teamName(teamNames.get(s.getTeamId()))
            .userId(s.getUserId()).isActive(s.getIsActive())
            .placed(s.getDepartmentId() != null && s.getEmail() != null && !s.getEmail().isBlank())
            .roles(roleCounts)
            .build();
    }
}
