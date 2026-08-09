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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

@Service
@Slf4j
@RequiredArgsConstructor
public class OrgService {

    private final DepartmentRepository departments;
    private final TeamRepository teams;
    private final OwnerRepository owners;
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

        List<Team> teamList = teamsFuture.join();
        List<TeamOwnerCountRow> ownerCounts = ownerCountsFuture.join();
        List<Department> allDepartments = departmentsFuture.join();

        return teamList.stream()
            .map(team -> TeamDto.builder()
                .teamId(team.getTeamId())
                .departmentId(team.getDepartmentId())
                .departmentName(resolveDepartmentName(allDepartments, team.getDepartmentId()))
                .name(team.getName())
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
            .isActive(request.getIsActive() == null || request.getIsActive())
            .build());

        return TeamDto.builder()
            .teamId(saved.getTeamId())
            .departmentId(saved.getDepartmentId())
            .departmentName(departments.findById(saved.getDepartmentId())
                .map(Department::getName)
                .orElse(null))
            .name(saved.getName())
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

        return ownerList.stream()
            .map(owner -> toDto(owner, allTeams, allDepartments))
            .toList();
    }

    @Transactional
    public OwnerDto createOwner(OwnerRequest request) {

        if (request.getFullName() == null || request.getFullName().isBlank()) {
            throw new IllegalArgumentException("Owner full name is required");
        }

        Integer departmentId = resolveDepartmentId(request.getDepartmentId(), request.getTeamId());

        Owner saved = owners.save(Owner.builder()
            .fullName(request.getFullName().trim())
            .email(normalize(request.getEmail()))
            .jobTitle(request.getJobTitle())
            .teamId(request.getTeamId())
            .departmentId(departmentId)
            .userId(request.getUserId())
            .isActive(request.getIsActive() == null || request.getIsActive())
            .build());

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();

        return toDto(saved, allTeams, allDepartments);
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
        if (request.getJobTitle() != null) {
            owner.setJobTitle(request.getJobTitle());
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

        owners.save(owner);

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();

        return toDto(owner, allTeams, allDepartments);
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

        List<Department> departmentList = departments.findAll().stream()
            .sorted(Comparator.comparing(Department::getName))
            .toList();

        List<Team> allTeams = teams.findAll();
        List<Department> allDepartments = departments.findAll();

        List<OrgTreeResponse.DepartmentNode> nodes = departmentList.stream()
            .map(department -> CompletableFuture
                .supplyAsync(() -> buildDepartmentNode(department, allDepartments, allTeams), virtualThreadExecutor))
            .map(CompletableFuture::join)
            .toList();

        return OrgTreeResponse.builder()
            .departments(nodes)
            .build();
    }

    private OrgTreeResponse.DepartmentNode buildDepartmentNode(
            Department department,
            List<Department> allDepartments,
            List<Team> allTeams) {

        List<Team> departmentTeams = teams.findByDepartmentIdOrderByNameAsc(department.getDepartmentId());

        List<OrgTreeResponse.TeamNode> teamNodes = departmentTeams.stream()
            .map(team -> CompletableFuture
                .supplyAsync(() -> buildTeamNode(team, allDepartments, allTeams), virtualThreadExecutor))
            .map(CompletableFuture::join)
            .toList();

        return OrgTreeResponse.DepartmentNode.builder()
            .department(DepartmentDto.builder()
                .departmentId(department.getDepartmentId())
                .name(department.getName())
                .code(department.getCode())
                .headOwnerId(department.getHeadOwnerId())
                .isActive(department.getIsActive())
                .build())
            .teams(teamNodes)
            .build();
    }

    private OrgTreeResponse.TeamNode buildTeamNode(
            Team team,
            List<Department> allDepartments,
            List<Team> allTeams) {

        List<Owner> teamOwners = owners.findByTeamIdOrderByFullNameAsc(team.getTeamId());

        return OrgTreeResponse.TeamNode.builder()
            .team(TeamDto.builder()
                .teamId(team.getTeamId())
                .departmentId(team.getDepartmentId())
                .departmentName(resolveDepartmentName(allDepartments, team.getDepartmentId()))
                .name(team.getName())
                .isActive(team.getIsActive())
                .ownerCount(teamOwners.size())
                .build())
            .owners(teamOwners.stream()
                .map(owner -> toDto(owner, allTeams, allDepartments))
                .toList())
            .build();
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

    private OwnerDto toDto(Owner owner, List<Team> allTeams, List<Department> allDepartments) {

        return OwnerDto.builder()
            .ownerId(owner.getOwnerId())
            .fullName(owner.getFullName())
            .email(owner.getEmail())
            .jobTitle(owner.getJobTitle())
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
