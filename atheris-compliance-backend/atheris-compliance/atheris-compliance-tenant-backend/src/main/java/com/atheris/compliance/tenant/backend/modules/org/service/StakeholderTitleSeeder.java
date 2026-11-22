package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderTitle;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.StakeholderTitleRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class StakeholderTitleSeeder {

    private final StakeholderTitleRepository titles;
    private final DepartmentRepository departments;
    private final TeamRepository teams;

    @Transactional
    public int seedDefaults() {
        Map<String, Integer> deptByName = departments.findAll().stream()
            .filter(d -> d.getName() != null)
            .collect(Collectors.toMap(d -> d.getName().trim().toLowerCase(Locale.ROOT),
                Department::getDepartmentId, (a, b) -> a));
        Map<String, Integer> teamByKey = teams.findAll().stream()
            .filter(t -> t.getName() != null)
            .collect(Collectors.toMap(t -> t.getDepartmentId() + "|" + t.getName().trim().toLowerCase(Locale.ROOT),
                Team::getTeamId, (a, b) -> a));

        int created = 0;
        for (StakeholderTitleCatalog.TitleDefault td : StakeholderTitleCatalog.TITLES) {
            if (titles.findFirstByNameIgnoreCase(td.title()).isPresent()) continue;
            Integer departmentId = deptByName.get(td.department().trim().toLowerCase(Locale.ROOT));
            Integer unitId = departmentId == null ? null
                : teamByKey.get(departmentId + "|" + td.unit().trim().toLowerCase(Locale.ROOT));
            titles.save(StakeholderTitle.builder()
                .name(td.title())
                .defaultDepartmentId(departmentId)
                .defaultUnitId(unitId)
                .isActive(true)
                .sortOrder(0)
                .build());
            created++;
        }
        log.info("[StakeholderTitles] seeded {}/{} sample titles", created, StakeholderTitleCatalog.TITLES.size());
        return created;
    }
}
