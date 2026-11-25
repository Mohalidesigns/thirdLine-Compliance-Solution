package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.org.dto.DepartmentReportDto;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.LinkTokens;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DepartmentReportService {

    @Value("${atheris.stakeholder.link-secret:dev-stakeholder-secret}")
    private String secret;

    private final DepartmentRepository departments;
    private final TeamRepository teams;
    private final ControlRepository controls;
    private final FindingRepository findings;
    private final ObligationClassificationRepository obligations;
    private final RegulatoryReturnRepository returns;
    private final TenantIdentityService tenantIdentity;

    public String departmentPath(Integer departmentId) {
        return "/department/" + departmentId + "/" + LinkTokens.token(secret, "department", departmentId.longValue());
    }

    public String unitPath(Integer teamId) {
        return "/unit/" + teamId + "/" + LinkTokens.token(secret, "unit", teamId.longValue());
    }

    @Transactional(readOnly = true)
    public DepartmentReportDto departmentReport(Integer departmentId, String token) {
        if (token == null || !token.equals(LinkTokens.token(secret, "department", departmentId.longValue()))) {
            throw ApiException.badRequest("invalid_link", "This reporting link is not valid");
        }
        Department d = departments.findById(departmentId)
            .orElseThrow(() -> ApiException.badRequest("invalid_link", "This reporting link is not valid"));
        return build("Department", d.getName(), null,
            obligations.findByAssignedDepartmentId(departmentId),
            activeOnly(controls.findByControlOwnerDepartmentId(departmentId)),
            findings.findByAssignedDepartmentId(departmentId),
            returns.findByDepartmentId(departmentId));
    }

    @Transactional(readOnly = true)
    public DepartmentReportDto unitReport(Integer teamId, String token) {
        if (token == null || !token.equals(LinkTokens.token(secret, "unit", teamId.longValue()))) {
            throw ApiException.badRequest("invalid_link", "This reporting link is not valid");
        }
        Team t = teams.findById(teamId)
            .orElseThrow(() -> ApiException.badRequest("invalid_link", "This reporting link is not valid"));
        String parent = t.getDepartmentId() == null ? null
            : departments.findById(t.getDepartmentId()).map(Department::getName).orElse(null);
        return build("Unit", t.getName(), parent,
            obligations.findByAssignedTeamId(teamId),
            activeOnly(controls.findByControlOwnerTeamId(teamId)),
            findings.findByAssignedTeamId(teamId),
            returns.findByTeamId(teamId));
    }

    private static List<Control> activeOnly(List<Control> cs) {
        return cs.stream().filter(c -> c.getStatus() == null || "Active".equalsIgnoreCase(c.getStatus())).toList();
    }

    private DepartmentReportDto build(String scopeType, String name, String parentDepartmentName,
                                      List<ObligationClassification> obligationList,
                                      List<Control> controlList,
                                      List<Finding> findingList,
                                      List<RegulatoryReturn> returnList) {
        Map<String, Long> byRisk = new LinkedHashMap<>();
        for (ObligationClassification o : obligationList) {
            String band = o.getInherentRiskRating() == null || o.getInherentRiskRating().isBlank()
                ? "Unrated" : o.getInherentRiskRating();
            byRisk.merge(band, 1L, Long::sum);
        }

        LocalDate today = LocalDate.now();
        List<Finding> openFindings = findingList.stream()
            .filter(f -> !WorkflowStatus.FINDING_CLOSED.equalsIgnoreCase(f.getStatus()))
            .toList();
        int overdueFindings = (int) openFindings.stream()
            .filter(f -> f.getRemediationDeadline() != null && f.getRemediationDeadline().isBefore(today))
            .count();

        List<DepartmentReportDto.Item> findings = openFindings.stream()
            .sorted(Comparator.comparing(Finding::getRemediationDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
            .limit(25)
            .map(f -> DepartmentReportDto.Item.builder()
                .title(f.getDescription())
                .detail(f.getFindingType())
                .status(f.getStatus())
                .dueDate(f.getRemediationDeadline() != null ? f.getRemediationDeadline().toString() : null)
                .build())
            .toList();

        List<DepartmentReportDto.Item> returns = returnList.stream()
            .sorted(Comparator.comparing(RegulatoryReturn::getReturnName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
            .limit(25)
            .map(r -> DepartmentReportDto.Item.builder()
                .title(r.getReturnName())
                .detail(r.getFilingRegulator())
                .status(r.getFrequency() != null ? r.getFrequency() : r.getFrequencyType())
                .build())
            .toList();

        return DepartmentReportDto.builder()
            .organizationName(tenantIdentity.currentProfile().map(p -> p.getLegalName()).orElse(null))
            .scopeType(scopeType)
            .name(name)
            .parentDepartmentName(parentDepartmentName)
            .obligationCount(obligationList.size())
            .obligationsByRisk(byRisk)
            .controlCount(controlList.size())
            .openFindingCount(openFindings.size())
            .overdueFindingCount(overdueFindings)
            .returnCount(returnList.size())
            .findings(findings)
            .returns(returns)
            .build();
    }
}
