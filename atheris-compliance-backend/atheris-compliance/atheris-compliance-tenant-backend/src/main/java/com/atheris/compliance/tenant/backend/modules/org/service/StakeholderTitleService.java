package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderTitleDto;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderTitleRequest;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderTitle;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.StakeholderTitleRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StakeholderTitleService {

    private final StakeholderTitleRepository titles;
    private final DepartmentRepository departments;
    private final TeamRepository teams;

    @Transactional(readOnly = true)
    public List<StakeholderTitleDto> list() {
        Map<Integer, String> deptNames = departments.findAll().stream()
            .collect(Collectors.toMap(Department::getDepartmentId, Department::getName));
        Map<Integer, String> teamNames = teams.findAll().stream()
            .collect(Collectors.toMap(Team::getTeamId, Team::getName));
        return titles.findAllByOrderBySortOrderAscNameAsc().stream()
            .map(t -> toDto(t, deptNames, teamNames))
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<Integer, String> namesById() {
        return titles.findAll().stream()
            .collect(Collectors.toMap(StakeholderTitle::getTitleId, StakeholderTitle::getName));
    }

    @Transactional(readOnly = true)
    public String nameOf(Integer titleId) {
        return titleId == null ? null : titles.findById(titleId).map(StakeholderTitle::getName).orElse(null);
    }

    @Transactional(readOnly = true)
    public StakeholderTitle findByName(String name) {
        return name == null || name.isBlank() ? null
            : titles.findFirstByNameIgnoreCase(name.trim()).orElse(null);
    }

    @Transactional
    public StakeholderTitleDto create(StakeholderTitleRequest request) {
        StakeholderTitle saved = resolveOrCreate(request.getName(), request.getDefaultDepartmentId(),
            request.getDefaultUnitId());
        if (request.getDefaultDepartmentId() != null || request.getDefaultUnitId() != null) {
            saved.setDefaultDepartmentId(request.getDefaultDepartmentId());
            saved.setDefaultUnitId(request.getDefaultUnitId());
            saved = titles.save(saved);
        }
        return toDto(saved, deptNameMap(), teamNameMap());
    }

    @Transactional
    public StakeholderTitleDto update(Integer titleId, StakeholderTitleRequest request) {
        StakeholderTitle title = titles.findById(titleId)
            .orElseThrow(() -> ApiException.notFound("Unknown title: " + titleId));
        if (request.getName() != null && !request.getName().isBlank()) {
            title.setName(request.getName().trim());
        }
        title.setDefaultDepartmentId(request.getDefaultDepartmentId());
        title.setDefaultUnitId(request.getDefaultUnitId());
        return toDto(titles.save(title), deptNameMap(), teamNameMap());
    }

    /** Find a title by name (case-insensitive) or create it. Never null for a non-blank name. */
    @Transactional
    public StakeholderTitle resolveOrCreate(String name, Integer defaultDepartmentId, Integer defaultUnitId) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("title_name_required", "A title name is required");
        }
        Optional<StakeholderTitle> existing = titles.findFirstByNameIgnoreCase(clean);
        if (existing.isPresent()) return existing.get();
        return titles.save(StakeholderTitle.builder()
            .name(clean)
            .defaultDepartmentId(defaultDepartmentId)
            .defaultUnitId(defaultUnitId)
            .isActive(true)
            .sortOrder(0)
            .build());
    }

    public StakeholderTitleDto toDto(StakeholderTitle t, Map<Integer, String> deptNames,
            Map<Integer, String> teamNames) {
        return StakeholderTitleDto.builder()
            .titleId(t.getTitleId())
            .name(t.getName())
            .defaultDepartmentId(t.getDefaultDepartmentId())
            .defaultDepartmentName(t.getDefaultDepartmentId() == null ? null : deptNames.get(t.getDefaultDepartmentId()))
            .defaultUnitId(t.getDefaultUnitId())
            .defaultUnitName(t.getDefaultUnitId() == null ? null : teamNames.get(t.getDefaultUnitId()))
            .isActive(t.getIsActive())
            .sortOrder(t.getSortOrder())
            .build();
    }

    private Map<Integer, String> deptNameMap() {
        return departments.findAll().stream()
            .collect(Collectors.toMap(Department::getDepartmentId, Department::getName));
    }

    private Map<Integer, String> teamNameMap() {
        return teams.findAll().stream()
            .collect(Collectors.toMap(Team::getTeamId, Team::getName));
    }
}
