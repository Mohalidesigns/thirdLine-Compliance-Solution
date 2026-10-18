package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds a sensible default compliance org structure (departments, each with teams) so a newly
 * onboarded tenant does not land on an empty Organisation page. Idempotent: does nothing if any
 * department already exists. Departments are created without heads and teams without owners —
 * people are added later in Settings (or the person picker). The department/team names mirror the
 * wording banks use for return ownership, so seeded returns map onto real units.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DefaultOrgSeedService {

    /** Department name → its team names. */
    private static final Map<String, List<String>> TEMPLATE = buildTemplate();

    private final DepartmentRepository departments;
    private final TeamRepository teams;

    /** Seeds the template once. Returns the number of departments created (0 when skipped). */
    @Transactional
    public int seedDefaults() {
        if (departments.count() > 0) {
            return 0;
        }
        int created = 0;
        for (Map.Entry<String, List<String>> entry : TEMPLATE.entrySet()) {
            Department department = departments.save(Department.builder()
                .name(entry.getKey())
                .isActive(true)
                .build());
            created++;
            for (String teamName : entry.getValue()) {
                teams.save(Team.builder()
                    .departmentId(department.getDepartmentId())
                    .name(teamName)
                    .isActive(true)
                    .build());
            }
        }
        log.info("[OrgSeed] Seeded default org structure: {} departments, {} teams",
            created, TEMPLATE.values().stream().mapToInt(List::size).sum());
        return created;
    }

    private static Map<String, List<String>> buildTemplate() {
        Map<String, List<String>> m = new LinkedHashMap<>();
        m.put("Compliance", List.of("AML/CFT Unit", "Regulatory Reporting", "Compliance Monitoring", "Sanctions Screening"));
        m.put("Risk Management", List.of("Credit Risk", "Operational Risk", "Market Risk"));
        m.put("Information Technology", List.of("Core Banking", "Database Administration", "Networking", "System Administration", "IT Security"));
        m.put("Operations", List.of("E-Banking", "Branch Operations", "Customer Service"));
        m.put("Finance & Treasury", List.of("Financial Reporting", "Treasury"));
        m.put("Internal Audit", List.of("Audit"));
        m.put("Legal & Company Secretariat", List.of("Legal"));
        m.put("Human Resources", List.of("HR"));
        return m;
    }
}
