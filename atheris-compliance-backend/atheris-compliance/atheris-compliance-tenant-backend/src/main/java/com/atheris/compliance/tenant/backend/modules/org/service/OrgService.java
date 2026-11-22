package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.dto.*;
import com.atheris.compliance.tenant.backend.modules.org.entity.*;
import com.atheris.compliance.tenant.backend.modules.org.repository.*;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository.DepartmentOwnerCountRow;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository.TeamOwnerCountRow;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository.DepartmentTeamCountRow;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

@Service
@Slf4j
@RequiredArgsConstructor
public class OrgService {

    private final DepartmentRepository departments;
    private final TeamRepository teams;
    private final OwnerRepository owners;
    private final com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository users;
    private final com.atheris.compliance.tenant.backend.modules.audit.service.AuditService audit;
    private final com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService tenantIdentity;
    private final StakeholderTitleService stakeholderTitles;
    private final ExecutorService virtualThreadExecutor;

    // ---------------------------------------------------------------- departments

    public List<DepartmentDto> listDepartments(boolean activeOnly) {

        CompletableFuture<List<Department>> departmentsFuture = CompletableFuture
            .supplyAsync(
                () -> activeOnly
                    ? departments.findByIsActiveTrueOrderByNameAsc()
                    : departments.findAll().stream()
                        .sorted(Comparator.comparing(Department::getName))
                        .toList(),
                virtualThreadExecutor);

        CompletableFuture<List<DepartmentTeamCountRow>> teamCountsFuture = CompletableFuture
            .supplyAsync(teams::countGroupedByDepartment, virtualThreadExecutor);

        CompletableFuture<List<DepartmentOwnerCountRow>> ownerCountsFuture = CompletableFuture
            .supplyAsync(owners::countGroupedByDepartment, virtualThreadExecutor);

        CompletableFuture<List<Owner>> ownersFuture = CompletableFuture
            .supplyAsync(owners::findAll, virtualThreadExecutor);

        List<Department> departmentList = departmentsFuture.join();
        List<DepartmentTeamCountRow> teamCounts = teamCountsFuture.join();
        List<DepartmentOwnerCountRow> ownerCounts = ownerCountsFuture.join();
        List<Owner> allOwners = ownersFuture.join();

        return departmentList.stream()
            .map(department -> DepartmentDto.builder()
                .departmentId(department.getDepartmentId())
                .name(department.getName())
                .code(department.getCode())
                .headOwnerId(department.getHeadOwnerId())
                .headOwnerName(resolveOwnerName(allOwners, department.getHeadOwnerId()))
                .isActive(department.getIsActive())
                .teamCount(departmentTeamCount(teamCounts, department.getDepartmentId()))
                .ownerCount(departmentOwnerCount(ownerCounts, department.getDepartmentId()))
                .build())
            .toList();
    }

    @Transactional
    public DepartmentDto createDepartment(DepartmentRequest request) {

        if (departments.existsByName(request.getName().trim())) {
            throw new IllegalArgumentException("Department already exists: " + request.getName());
        }

        Department saved = departments.save(Department.builder()
            .name(request.getName().trim())
            .code(normalize(request.getCode()))
            .headOwnerId(request.getHeadOwnerId())
            .isActive(request.getIsActive() == null || request.getIsActive())
            .build());

        return DepartmentDto.builder()
            .departmentId(saved.getDepartmentId())
            .name(saved.getName())
            .code(saved.getCode())
            .headOwnerId(saved.getHeadOwnerId())
            .headOwnerName(saved.getHeadOwnerId() != null
                ? owners.findById(saved.getHeadOwnerId()).map(Owner::getFullName).orElse(null)
                : null)
            .isActive(saved.getIsActive())
            .teamCount(0)
            .ownerCount(0)
            .build();
    }

    @Transactional
    public DepartmentDto updateDepartment(Integer id, DepartmentRequest request) {

        Department department = departments.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Department not found: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            department.setName(request.getName().trim());
        }
        if (request.getCode() != null) {
            department.setCode(normalize(request.getCode()));
        }
        if (request.getHeadOwnerId() != null) {
            department.setHeadOwnerId(request.getHeadOwnerId());
        }
        if (request.getIsActive() != null) {
            department.setIsActive(request.getIsActive());
        }

        departments.save(department);

        return listDepartments(false).stream()
            .filter(dto -> dto.getDepartmentId().equals(id))
            .findFirst()
            .orElseThrow(() -> new EntityNotFoundException("Department not found: " + id));
    }

    @Transactional
    public void deleteDepartment(Integer id) {

        Department department = departments.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Department not found: " + id));

        boolean hasActiveTeams = teams.findByDepartmentIdOrderByNameAsc(id).stream()
            .anyMatch(team -> Boolean.TRUE.equals(team.getIsActive()));

        boolean hasActiveOwners = owners.findByDepartmentIdOrderByFullNameAsc(id).stream()
            .anyMatch(owner -> Boolean.TRUE.equals(owner.getIsActive()));

        if (hasActiveTeams || hasActiveOwners) {
            department.setIsActive(false);
            departments.save(department);
            return;
        }

        departments.delete(department);
    }

    // ---------------------------------------------------------------- teams

    public List<TeamDto> listTeams(Integer departmentId) {

        CompletableFuture<List<Team>> teamsFuture = CompletableFuture
            .supplyAsync(
                () -> departmentId != null
                    ? teams.findByDepartmentIdOrderByNameAsc(departmentId)
                    : teams.findAll().stream()
                        .sorted(Comparator.comparing(Team::getName))
                        .toList(),
                virtualThreadExecutor);

        CompletableFuture<List<TeamOwnerCountRow>> ownerCountsFuture = CompletableFuture
            .supplyAsync(owners::countGroupedByTeam, virtualThreadExecutor);

        CompletableFuture<List<Department>> departmentsFuture = CompletableFuture
            .supplyAsync(departments::findAll, virtualThreadExecutor);

        CompletableFuture<List<Owner>> ownersFuture = CompletableFuture
            .supplyAsync(owners::findAll, virtualThreadExecutor);

        List<Team> teamList = teamsFuture.join();
        List<TeamOwnerCountRow> ownerCounts = ownerCountsFuture.join();
        List<Department> allDepartments = departmentsFuture.join();
        List<Owner> allOwners = ownersFuture.join();

        return teamList.stream()
            .map(team -> TeamDto.builder()
                .teamId(team.getTeamId())
                .departmentId(team.getDepartmentId())
                .departmentName(resolveDepartmentName(allDepartments, team.getDepartmentId()))
                .name(team.getName())
                .headOwnerId(team.getHeadOwnerId())
                .headOwnerName(resolveOwnerName(allOwners, team.getHeadOwnerId()))
                .isActive(team.getIsActive())
                .ownerCount(teamOwnerCount(ownerCounts, team.getTeamId()))
                .build())
            .toList();
    }

    @Transactional
    public TeamDto createTeam(TeamRequest request) {

        if (request.getDepartmentId() == null) {
            throw new IllegalArgumentException("Department is required for a team");
        }
        if (!departments.existsById(request.getDepartmentId())) {
            throw new EntityNotFoundException("Department not found: " + request.getDepartmentId());
        }

        Team saved = teams.save(Team.builder()
            .departmentId(request.getDepartmentId())
            .name(request.getName().trim())
            .headOwnerId(request.getHeadOwnerId())
            .isActive(request.getIsActive() == null || request.getIsActive())
            .build());

        return TeamDto.builder()
            .teamId(saved.getTeamId())
            .departmentId(saved.getDepartmentId())
            .departmentName(departments.findById(saved.getDepartmentId())
                .map(Department::getName)
                .orElse(null))
            .name(saved.getName())
            .headOwnerId(saved.getHeadOwnerId())
            .headOwnerName(saved.getHeadOwnerId() != null
                ? owners.findById(saved.getHeadOwnerId()).map(Owner::getFullName).orElse(null)
                : null)
            .isActive(saved.getIsActive())
            .ownerCount(0)
            .build();
    }

    @Transactional
    public TeamDto updateTeam(Integer id, TeamRequest request) {

        Team team = teams.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            team.setName(request.getName().trim());
        }
        if (request.getDepartmentId() != null) {
            team.setDepartmentId(request.getDepartmentId());
        }
        if (request.getHeadOwnerId() != null) {
            team.setHeadOwnerId(request.getHeadOwnerId());
        }
        if (request.getIsActive() != null) {
            team.setIsActive(request.getIsActive());
        }

        teams.save(team);

        return listTeams(team.getDepartmentId()).stream()
            .filter(dto -> dto.getTeamId().equals(id))
            .findFirst()
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + id));
    }

    @Transactional
    public void deleteTeam(Integer id) {

        Team team = teams.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + id));

        boolean hasActiveOwners = owners.findByTeamIdOrderByFullNameAsc(id).stream()
            .anyMatch(owner -> Boolean.TRUE.equals(owner.getIsActive()));

        if (hasActiveOwners) {
            team.setIsActive(false);
            teams.save(team);
            return;
        }

        teams.delete(team);
    }

    // ---------------------------------------------------------------- owners

    public List<OwnerDto> listOwners(Integer teamId, Integer departmentId) {

        List<Owner> ownerList;
        if (teamId != null) {
            ownerList = owners.findByTeamIdOrderByFullNameAsc(teamId);
        } else if (departmentId != null) {
            ownerList = owners.findByDepartmentIdOrderByFullNameAsc(departmentId);
        } else {
            ownerList = owners.findByIsActiveTrueOrderByFullNameAsc();
        }

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();
        Map<Integer, String> titleNames = stakeholderTitles.namesById();

        return ownerList.stream()
            .map(owner -> toDto(owner, allTeams, allDepartments, titleNames))
            .toList();
    }

    @Transactional
    public OwnerDto createOwner(OwnerRequest request) {

        if (request.getFullName() == null || request.getFullName().isBlank()) {
            throw new IllegalArgumentException("Owner full name is required");
        }

        Integer departmentId = resolveDepartmentId(request.getDepartmentId(), request.getTeamId());

        if (departmentId == null || request.getEmail() == null || request.getEmail().isBlank()) {
            throw com.atheris.compliance.tenant.backend.shared.exception.ApiException.badRequest(
                "stakeholder_placement_required",
                "A stakeholder must have an email and a department");
        }

        Owner saved = owners.save(Owner.builder()
            .fullName(request.getFullName().trim())
            .email(normalize(request.getEmail()))
            .titleId(request.getTitleId())
            .teamId(request.getTeamId())
            .departmentId(departmentId)
            .userId(request.getUserId())
            .isActive(request.getIsActive() == null || request.getIsActive())
            .build());
        audit.logCurrentUser("owner_created", "owner", saved.getOwnerId().longValue(),
            java.util.Map.of("fullName", saved.getFullName()));

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();

        return toDto(saved, allTeams, allDepartments, stakeholderTitles.namesById());
    }

    @Transactional
    public OwnerDto updateOwner(Integer id, OwnerRequest request) {

        Owner owner = owners.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + id));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            owner.setFullName(request.getFullName().trim());
        }
        if (request.getEmail() != null) {
            owner.setEmail(normalize(request.getEmail()));
        }
        if (request.getTitleId() != null) {
            owner.setTitleId(request.getTitleId());
        }
        if (request.getTeamId() != null || request.getDepartmentId() != null) {
            owner.setTeamId(request.getTeamId());
            owner.setDepartmentId(resolveDepartmentId(request.getDepartmentId(), request.getTeamId()));
        }
        if (request.getUserId() != null) {
            owner.setUserId(request.getUserId());
        }
        if (request.getIsActive() != null) {
            owner.setIsActive(request.getIsActive());
        }

        boolean willBeActive = request.getIsActive() == null
            ? Boolean.TRUE.equals(owner.getIsActive()) : Boolean.TRUE.equals(request.getIsActive());
        if (willBeActive && (owner.getDepartmentId() == null || owner.getEmail() == null || owner.getEmail().isBlank())) {
            throw com.atheris.compliance.tenant.backend.shared.exception.ApiException.badRequest(
                "stakeholder_placement_required",
                "A stakeholder must have an email and a department");
        }

        owners.save(owner);

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();

        return toDto(owner, allTeams, allDepartments, stakeholderTitles.namesById());
    }

    @Transactional
    public void deleteOwner(Integer id) {

        Owner owner = owners.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + id));

        owner.setIsActive(false);
        owners.save(owner);
    }

    // ---------------------------------------------------------------- tree

    public OrgTreeResponse getOrgTree() {

        List<Department> allDepartments = departments.findAll().stream()
            .sorted(Comparator.comparing(Department::getName))
            .toList();
        List<Team> allTeams = teams.findAll().stream()
            .sorted(Comparator.comparing(Team::getName))
            .toList();
        List<Owner> allOwners = owners.findAll().stream()
            .sorted(Comparator.comparing(Owner::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
            .toList();

        Map<Integer, String> titleNames = stakeholderTitles.namesById();

        List<OrgTreeResponse.DepartmentNode> nodes = allDepartments.stream()
            .map(department -> buildDepartmentNode(department, allDepartments, allTeams, allOwners, titleNames))
            .toList();

        List<OrgTreeResponse.UserNode> userNodes = users.findByIsActiveTrue().stream()
            .sorted(Comparator.comparing(com.atheris.compliance.tenant.backend.modules.users.entity.User::getFullName,
                Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(user -> OrgTreeResponse.UserNode.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .jobTitle(user.getJobTitle())
                .role(user.getRole())
                .department(user.getDepartment())
                .isActive(user.getIsActive())
                .build())
            .toList();

        List<OwnerDto> unassignedOwners = allOwners.stream()
            .filter(owner -> owner.getDepartmentId() == null && owner.getTeamId() == null)
            .map(owner -> toDto(owner, allTeams, allDepartments, titleNames))
            .toList();

        return OrgTreeResponse.builder()
            .organizationName(tenantIdentity.currentProfile().map(p -> p.getLegalName()).orElse(null))
            .departments(nodes)
            .users(userNodes)
            .unassignedOwners(unassignedOwners)
            .build();
    }

    private OrgTreeResponse.DepartmentNode buildDepartmentNode(
            Department department,
            List<Department> allDepartments,
            List<Team> allTeams,
            List<Owner> allOwners,
            Map<Integer, String> titleNames) {

        List<Team> departmentTeams = allTeams.stream()
            .filter(team -> team.getDepartmentId().equals(department.getDepartmentId()))
            .toList();

        List<OrgTreeResponse.TeamNode> teamNodes = departmentTeams.stream()
            .map(team -> buildTeamNode(team, allDepartments, allTeams, allOwners, titleNames))
            .toList();

        List<OwnerDto> departmentOwners = allOwners.stream()
            .filter(owner -> department.getDepartmentId().equals(owner.getDepartmentId()))
            .filter(owner -> owner.getTeamId() == null)
            .map(owner -> toDto(owner, allTeams, allDepartments, titleNames))
            .toList();

        return OrgTreeResponse.DepartmentNode.builder()
            .department(DepartmentDto.builder()
                .departmentId(department.getDepartmentId())
                .name(department.getName())
                .code(department.getCode())
                .headOwnerId(department.getHeadOwnerId())
                .headOwnerName(resolveOwnerName(allOwners, department.getHeadOwnerId()))
                .isActive(department.getIsActive())
                .build())
            .teams(teamNodes)
            .owners(departmentOwners)
            .build();
    }

    private OrgTreeResponse.TeamNode buildTeamNode(
            Team team,
            List<Department> allDepartments,
            List<Team> allTeams,
            List<Owner> allOwners,
            Map<Integer, String> titleNames) {

        List<OwnerDto> teamOwners = allOwners.stream()
            .filter(owner -> team.getTeamId().equals(owner.getTeamId()))
            .map(owner -> toDto(owner, allTeams, allDepartments, titleNames))
            .toList();

        return OrgTreeResponse.TeamNode.builder()
            .team(TeamDto.builder()
                .teamId(team.getTeamId())
                .departmentId(team.getDepartmentId())
                .departmentName(resolveDepartmentName(allDepartments, team.getDepartmentId()))
                .name(team.getName())
                .headOwnerId(team.getHeadOwnerId())
                .headOwnerName(resolveOwnerName(allOwners, team.getHeadOwnerId()))
                .isActive(team.getIsActive())
                .ownerCount(teamOwners.size())
                .build())
            .owners(teamOwners)
            .build();
    }

    @Transactional
    public void setDepartmentHead(Integer id, Integer ownerId) {
        Department department = departments.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Department not found: " + id));
        if (ownerId != null && !owners.existsById(ownerId)) {
            throw new EntityNotFoundException("Stakeholder not found: " + ownerId);
        }
        department.setHeadOwnerId(ownerId);
        departments.save(department);
    }

    @Transactional
    public void clearDepartmentHead(Integer id) {
        setDepartmentHead(id, null);
    }

    @Transactional
    public void setTeamHead(Integer id, Integer ownerId) {
        Team team = teams.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + id));
        if (ownerId != null && !owners.existsById(ownerId)) {
            throw new EntityNotFoundException("Stakeholder not found: " + ownerId);
        }
        team.setHeadOwnerId(ownerId);
        teams.save(team);
    }

    @Transactional
    public void clearTeamHead(Integer id) {
        setTeamHead(id, null);
    }

    // ---------------------------------------------------------------- helpers

    private Integer resolveDepartmentId(Integer departmentId, Integer teamId) {

        if (departmentId != null) {
            return departmentId;
        }
        if (teamId != null) {
            return teams.findById(teamId)
                .map(Team::getDepartmentId)
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + teamId));
        }
        return null;
    }

    private OwnerDto toDto(Owner owner, List<Team> allTeams, List<Department> allDepartments,
            Map<Integer, String> titleNames) {

        return OwnerDto.builder()
            .ownerId(owner.getOwnerId())
            .fullName(owner.getFullName())
            .email(owner.getEmail())
            .titleId(owner.getTitleId())
            .jobTitle(owner.getTitleId() == null ? null : titleNames.get(owner.getTitleId()))
            .teamId(owner.getTeamId())
            .teamName(owner.getTeamId() != null
                ? resolveTeamName(allTeams, owner.getTeamId())
                : null)
            .departmentId(owner.getDepartmentId())
            .departmentName(owner.getDepartmentId() != null
                ? resolveDepartmentName(allDepartments, owner.getDepartmentId())
                : null)
            .userId(owner.getUserId())
            .isActive(owner.getIsActive())
            .build();
    }

    private static String resolveOwnerName(List<Owner> owners, Integer ownerId) {

        if (ownerId == null) {
            return null;
        }

        return owners.stream()
            .filter(owner -> owner.getOwnerId().equals(ownerId))
            .findFirst()
            .map(Owner::getFullName)
            .orElse(null);
    }

    private static String resolveDepartmentName(List<Department> departments, Integer departmentId) {

        if (departmentId == null) {
            return null;
        }

        return departments.stream()
            .filter(department -> department.getDepartmentId().equals(departmentId))
            .findFirst()
            .map(Department::getName)
            .orElse(null);
    }

    private static String resolveTeamName(List<Team> teams, Integer teamId) {

        if (teamId == null) {
            return null;
        }

        return teams.stream()
            .filter(team -> team.getTeamId().equals(teamId))
            .findFirst()
            .map(Team::getName)
            .orElse(null);
    }

    private static Integer departmentTeamCount(List<DepartmentTeamCountRow> rows, Integer departmentId) {

        return rows.stream()
            .filter(row -> row.getDepartmentId().equals(departmentId))
            .findFirst()
            .map(row -> (int) row.getRowCount())
            .orElse(0);
    }

    private static Integer departmentOwnerCount(List<DepartmentOwnerCountRow> rows, Integer departmentId) {

        return rows.stream()
            .filter(row -> row.getDepartmentId().equals(departmentId))
            .findFirst()
            .map(row -> (int) row.getRowCount())
            .orElse(0);
    }

    private static Integer teamOwnerCount(List<TeamOwnerCountRow> rows, Integer teamId) {

        return rows.stream()
            .filter(row -> row.getTeamId().equals(teamId))
            .findFirst()
            .map(row -> (int) row.getRowCount())
            .orElse(0);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
