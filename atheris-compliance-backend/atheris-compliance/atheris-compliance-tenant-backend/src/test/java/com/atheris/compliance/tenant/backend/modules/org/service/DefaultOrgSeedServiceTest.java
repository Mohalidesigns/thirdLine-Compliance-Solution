package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DefaultOrgSeedServiceTest {

    private final DepartmentRepository departments = mock(DepartmentRepository.class);
    private final TeamRepository teams = mock(TeamRepository.class);
    private final DefaultOrgSeedService service = new DefaultOrgSeedService(departments, teams);

    @Test
    void reusesTheSeededComplianceDepartmentAndAddsTheMissingOnes() {
        Department compliance = Department.builder().departmentId(1).name("Compliance").build();
        when(departments.findByName("Compliance")).thenReturn(Optional.of(compliance));
        when(departments.findByName(anyStringExceptCompliance())).thenReturn(Optional.empty());
        when(departments.save(any(Department.class))).thenAnswer(inv -> {
            Department d = inv.getArgument(0);
            d.setDepartmentId(99);
            return d;
        });
        when(teams.findByDepartmentIdOrderByNameAsc(anyInt())).thenReturn(List.of());
        List<Team> createdTeams = new ArrayList<>();
        when(teams.save(any(Team.class))).thenAnswer(inv -> {
            Team t = inv.getArgument(0);
            createdTeams.add(t);
            return t;
        });

        int createdDepartments = service.seedDefaults();

        assertEquals(DefaultOrgSeedService.TEMPLATE.size() - 1, createdDepartments,
            "every template department except the pre-existing Compliance is created");
        verify(departments, never()).save(argThat(d -> "Compliance".equals(d.getName())));
        List<String> complianceTeams = DefaultOrgSeedService.TEMPLATE.get("Compliance");
        assertEquals(complianceTeams.size(),
            createdTeams.stream().filter(t -> t.getDepartmentId() == 1).count(),
            "Compliance is given all of its template teams, not skipped");
        assertTrue(createdTeams.stream().anyMatch(t -> complianceTeams.contains(t.getName())));
    }

    @Test
    void secondRunCreatesNothingWhenTheTemplateExists() {
        when(departments.findByName(anyString())).thenReturn(Optional.of(
            Department.builder().departmentId(1).name("Compliance").build()));
        List<Team> allTemplateTeams = DefaultOrgSeedService.TEMPLATE.values().stream()
            .flatMap(List::stream).map(n -> Team.builder().name(n).build()).toList();
        when(teams.findByDepartmentIdOrderByNameAsc(anyInt())).thenReturn(allTemplateTeams);

        assertEquals(0, service.seedDefaults());
        verify(departments, never()).save(any());
        verify(teams, never()).save(any());
    }

    private static String anyStringExceptCompliance() {
        return org.mockito.ArgumentMatchers.argThat((String s) -> !"Compliance".equals(s));
    }
}