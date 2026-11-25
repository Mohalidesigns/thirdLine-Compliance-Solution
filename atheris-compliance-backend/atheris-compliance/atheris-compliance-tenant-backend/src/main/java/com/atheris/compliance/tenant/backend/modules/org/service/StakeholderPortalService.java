package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderPortalDto;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnResponsibleStakeholder;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnResponsibleStakeholderRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.LinkTokens;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StakeholderPortalService {

    @Value("${atheris.stakeholder.link-secret:dev-stakeholder-secret}")
    private String secret;

    private final OwnerRepository stakeholders;
    private final DepartmentRepository departments;
    private final TeamRepository teams;
    private final ControlRepository controls;
    private final FindingRepository findings;
    private final ReturnResponsibleStakeholderRepository returnResponsibles;
    private final RegulatoryReturnRepository returns;

    public String tokenFor(Integer stakeholderId) {
        return LinkTokens.token(secret, "stakeholder", stakeholderId.longValue());
    }

    public String pathFor(Integer stakeholderId) {
        return "/stakeholder/" + stakeholderId + "/" + tokenFor(stakeholderId);
    }

    @Transactional(readOnly = true)
    public StakeholderPortalDto view(Integer stakeholderId, String token) {
        if (token == null || !token.equals(tokenFor(stakeholderId))) {
            throw ApiException.badRequest("invalid_link", "This stakeholder link is not valid");
        }
        Owner s = stakeholders.findById(stakeholderId)
            .orElseThrow(() -> ApiException.badRequest("invalid_link", "This stakeholder link is not valid"));

        List<StakeholderPortalDto.Item> items = new ArrayList<>();
        for (Control c : activeOnly(controls.findByControlOwnerId(stakeholderId))) {
            items.add(item("Owner", "control", c.getControlId().longValue(), c.getName(),
                c.getControlNumber(), null));
        }
        for (Control c : activeOnly(controls.findByTesterOwnerId(stakeholderId))) {
            items.add(item("Tester", "control", c.getControlId().longValue(), c.getName(),
                c.getControlNumber(), null));
        }
        for (Finding f : findings.findByAssignedToOwnerId(stakeholderId)) {
            items.add(item("Remediation owner", "finding", f.getFindingId(),
                f.getDescription(), f.getStatus(),
                f.getRemediationDeadline() != null ? f.getRemediationDeadline().toString() : null));
        }
        List<Long> returnIds = returnResponsibles.findByStakeholderId(stakeholderId).stream()
            .map(ReturnResponsibleStakeholder::getReturnId).toList();
        if (!returnIds.isEmpty()) {
            for (RegulatoryReturn r : returns.findAllById(returnIds)) {
                items.add(item("Responsible", "return", r.getReturnId(),
                    r.getReturnName(), r.getFilingRegulator(), null));
            }
        }

        String deptName = s.getDepartmentId() == null ? null
            : departments.findById(s.getDepartmentId()).map(Department::getName).orElse(null);
        String teamName = s.getTeamId() == null ? null
            : teams.findById(s.getTeamId()).map(Team::getName).orElse(null);

        return StakeholderPortalDto.builder()
            .fullName(s.getFullName()).departmentName(deptName).teamName(teamName).items(items).build();
    }

    private static List<Control> activeOnly(List<Control> cs) {
        return cs.stream().filter(c -> c.getStatus() == null || "Active".equalsIgnoreCase(c.getStatus())).toList();
    }

    private static StakeholderPortalDto.Item item(String role, String subjectType, Long subjectId,
                                                  String title, String detail, String dueDate) {
        return StakeholderPortalDto.Item.builder()
            .role(role).subjectType(subjectType).subjectId(subjectId)
            .title(title).detail(detail).dueDate(dueDate).build();
    }
}
