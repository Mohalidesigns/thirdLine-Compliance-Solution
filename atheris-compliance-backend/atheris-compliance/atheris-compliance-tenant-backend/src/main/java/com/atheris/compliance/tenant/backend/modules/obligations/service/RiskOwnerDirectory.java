package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RiskOwnerDirectory {

    private final ObligationClassificationRepository classifications;
    private final OwnerRepository owners;
    private final DepartmentRepository departments;

    @Transactional(readOnly = true)
    public List<String> ccEmailsForControl(Control control) {
        if (control == null || control.getLinkedObligationIds() == null
                || control.getLinkedObligationIds().isEmpty()) {
            return List.of();
        }
        return ccEmailsForObligations(control.getLinkedObligationIds());
    }

    @Transactional(readOnly = true)
    public List<String> ccEmailsForFinding(Finding finding) {
        if (finding == null || finding.getLinkedObligationId() == null) return List.of();
        return ccEmailsForObligations(List.of(finding.getLinkedObligationId()));
    }

    @Transactional(readOnly = true)
    public Map<String, String> detailVarsForControl(Control control) {
        if (control == null || control.getLinkedObligationIds() == null
                || control.getLinkedObligationIds().isEmpty()) {
            return Map.of("riskOwner", "", "riskUnit", "");
        }
        return detailVars(control.getLinkedObligationIds());
    }

    @Transactional(readOnly = true)
    public Map<String, String> detailVarsForFinding(Finding finding) {
        if (finding == null || finding.getLinkedObligationId() == null) {
            return Map.of("riskOwner", "", "riskUnit", "");
        }
        return detailVars(List.of(finding.getLinkedObligationId()));
    }

    List<String> ccEmailsForObligations(Collection<Long> obligationIds) {
        People people = resolve(obligationIds);
        Set<String> emails = new LinkedHashSet<>();
        for (Owner o : people.owners()) {
            if (notBlank(o.getEmail())) emails.add(o.getEmail());
        }
        for (Owner head : people.departmentHeads()) {
            if (notBlank(head.getEmail())) emails.add(head.getEmail());
        }
        return new ArrayList<>(emails);
    }

    Map<String, String> detailVars(Collection<Long> obligationIds) {
        People people = resolve(obligationIds);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("riskOwner", joinNames(people.owners()));
        vars.put("riskUnit", joinDepartments(people.departments()).isBlank()
            ? joinNames(people.departmentHeads()) : joinDepartments(people.departments()));
        return vars;
    }

    private People resolve(Collection<Long> obligationIds) {
        List<ObligationClassification> rows = classifications.findByObligationIdIn(obligationIds);
        Set<Integer> ownerIds = new LinkedHashSet<>();
        Set<Integer> departmentIds = new LinkedHashSet<>();
        Map<Integer, Owner> ownersById = new LinkedHashMap<>();
        for (ObligationClassification c : rows) {
            if (c.getAssignedOwnerId() != null) ownerIds.add(c.getAssignedOwnerId());
            if (c.getAssignedDepartmentId() != null) departmentIds.add(c.getAssignedDepartmentId());
        }
        for (Owner o : owners.findAllById(ownerIds)) {
            ownersById.put(o.getOwnerId(), o);
            if (o.getDepartmentId() != null) departmentIds.add(o.getDepartmentId());
        }
        List<Department> depts = departments.findAllById(departmentIds).stream()
            .filter(d -> d.getHeadOwnerId() != null).toList();
        Set<Integer> headIds = new LinkedHashSet<>();
        for (Department d : depts) headIds.add(d.getHeadOwnerId());
        List<Owner> heads = owners.findAllById(headIds).stream()
            .filter(o -> !ownersById.containsKey(o.getOwnerId())).toList();
        return new People(new ArrayList<>(ownersById.values()), depts, heads);
    }

    private static String joinNames(Collection<Owner> owners) {
        return owners.stream().map(Owner::getFullName).filter(Objects::nonNull).distinct()
            .reduce((a, b) -> a + ", " + b).orElse("");
    }

    private static String joinDepartments(Collection<Department> departments) {
        return departments.stream().map(Department::getName).filter(Objects::nonNull).distinct()
            .reduce((a, b) -> a + ", " + b).orElse("");
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private record People(List<Owner> owners, List<Department> departments, List<Owner> departmentHeads) {}
}