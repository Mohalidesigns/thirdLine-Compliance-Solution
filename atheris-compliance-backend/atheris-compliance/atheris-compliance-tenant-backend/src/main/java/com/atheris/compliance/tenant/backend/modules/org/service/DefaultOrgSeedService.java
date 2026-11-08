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
import java.util.Set;
import java.util.stream.Collectors;

/** Seeds the default department/team org structure; idempotent per name. */
@Service
@Slf4j
@RequiredArgsConstructor
public class DefaultOrgSeedService {

    /** Department name → its team names. */
    private static final Map<String, List<String>> TEMPLATE = buildTemplate();

    private final DepartmentRepository departments;
    private final TeamRepository teams;

    /** Seeds any missing template departments/teams. Returns the number of departments created. */
    @Transactional
    public int seedDefaults() {
        int created = 0;
        int teamsCreated = 0;
        for (Map.Entry<String, List<String>> entry : TEMPLATE.entrySet()) {
            Department department = departments.findByName(entry.getKey()).orElse(null);
            if (department == null) {
                department = departments.save(Department.builder()
                    .name(entry.getKey())
                    .isActive(true)
                    .build());
                created++;
            }
            Set<String> existingTeams = teams.findByDepartmentIdOrderByNameAsc(department.getDepartmentId())
                .stream().map(Team::getName).collect(Collectors.toSet());
            for (String teamName : entry.getValue()) {
                if (!existingTeams.contains(teamName)) {
                    teams.save(Team.builder()
                        .departmentId(department.getDepartmentId())
                        .name(teamName)
                        .isActive(true)
                        .build());
                    teamsCreated++;
                }
            }
        }
        log.info("[OrgSeed] Default org structure: {} departments, {} teams created",
            created, teamsCreated);
        return created;
    }

    private static Map<String, List<String>> buildTemplate() {
        Map<String, List<String>> m = new LinkedHashMap<>();
        m.put("Compliance", List.of("Regulatory Compliance", "Data Protection", "AML/CFT", "Monitoring & Testing", "Conduct & Ethics"));
        m.put("Risk Management", List.of("Enterprise Risk", "Operational Risk", "Credit Risk", "Market & Liquidity Risk"));
        m.put("Information Technology", List.of("Core Banking", "Database Administration", "Networking", "System Administration", "IT Security"));
        m.put("Operations", List.of("Branch Operations", "Cash Management", "Transaction Processing", "Trade Services", "Customer Service"));
        m.put("Finance & Treasury", List.of("Financial Control", "Treasury", "Regulatory Reporting", "Tax", "Procurement"));
        m.put("Internal Audit", List.of("Audit Operations", "Audit Assurance"));
        m.put("Legal & Company Secretariat", List.of("Legal Advisory", "Company Secretariat", "Litigation & Disputes"));
        m.put("Human Resources", List.of("HR Operations", "Learning & Development", "Recruitment"));
        return m;
    }
}
