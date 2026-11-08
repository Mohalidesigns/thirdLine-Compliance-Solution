package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RiskOwnerDirectoryTest {

    private final ObligationClassificationRepository classifications =
        mock(ObligationClassificationRepository.class);
    private final OwnerRepository owners = mock(OwnerRepository.class);
    private final DepartmentRepository departments = mock(DepartmentRepository.class);
    private final RiskOwnerDirectory directory =
        new RiskOwnerDirectory(classifications, owners, departments);

    @Test
    void resolvesObligationOwnerAndDepartmentHead() {
        when(classifications.findByObligationIdIn(any())).thenReturn(List.of(classification(5L, 100, 7)));
        when(owners.findAllById(any()))
            .thenReturn(List.of(owner(100, "Risk Owner", "risk@x.test", 7)))
            .thenReturn(List.of(owner(200, "Dept Head", "head@x.test", 7)));
        when(departments.findAllById(any())).thenReturn(List.of(department(7, "Compliance", 200)));

        assertEquals(List.of("risk@x.test", "head@x.test"), directory.ccEmailsForObligations(List.of(5L)));
    }

    @Test
    void detailVarsCarryOwnerNamesAndUnit() {
        when(classifications.findByObligationIdIn(any())).thenReturn(List.of(classification(5L, 100, 7)));
        when(owners.findAllById(any()))
            .thenReturn(List.of(owner(100, "Risk Owner", "risk@x.test", 7)))
            .thenReturn(List.of(owner(200, "Dept Head", "head@x.test", 7)));
        when(departments.findAllById(any())).thenReturn(List.of(department(7, "Compliance", 200)));

        Map<String, String> vars = directory.detailVars(List.of(5L));

        assertEquals("Risk Owner", vars.get("riskOwner"));
        assertEquals("Compliance", vars.get("riskUnit"));
    }

    @Test
    void emptyWhenNoOwnerAssigned() {
        when(classifications.findByObligationIdIn(any())).thenReturn(List.of(classification(5L, null, null)));
        when(owners.findAllById(any())).thenReturn(List.of());
        when(departments.findAllById(any())).thenReturn(List.of());

        assertEquals(List.of(), directory.ccEmailsForObligations(List.of(5L)));
        assertEquals("", directory.detailVars(List.of(5L)).get("riskOwner"));
    }

    private static ObligationClassification classification(Long obligationId, Integer ownerId, Integer departmentId) {
        return ObligationClassification.builder()
            .obligationId(obligationId)
            .assignedOwnerId(ownerId)
            .assignedDepartmentId(departmentId)
            .build();
    }

    private static Owner owner(Integer id, String name, String email, Integer departmentId) {
        return Owner.builder().ownerId(id).fullName(name).email(email).departmentId(departmentId).build();
    }

    private static Department department(Integer id, String name, Integer headOwnerId) {
        return Department.builder().departmentId(id).name(name).headOwnerId(headOwnerId).build();
    }
}