package com.atheris.compliance.tenant.backend.modules.settings.service;

import com.atheris.compliance.tenant.backend.modules.risk.service.ResidualRule;
import com.atheris.compliance.tenant.backend.modules.settings.dto.ComplianceSettingsRequest;
import com.atheris.compliance.tenant.backend.modules.settings.dto.ComplianceSettingsResponse;
import com.atheris.compliance.tenant.backend.modules.settings.entity.TenantComplianceSettings;
import com.atheris.compliance.tenant.backend.modules.settings.repository.TenantComplianceSettingsRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service @RequiredArgsConstructor
public class ComplianceSettingsService {

    private static final List<String> AXES = List.of("LIKELIHOOD", "IMPACT", "BOTH");
    private static final List<String> TARGETS = List.of("Passed", "PassedOrPartial");

    private final TenantComplianceSettingsRepository repo;
    private final TenantIdentityService tenantIdentity;

    @Transactional(readOnly = true)
    public TenantComplianceSettings current() {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId == null) return TenantComplianceSettings.builder().tenantId(null).build();
        return repo.findByTenantId(tenantId)
            .orElseGet(() -> TenantComplianceSettings.builder().tenantId(tenantId).build());
    }

    @Transactional
    public TenantComplianceSettings currentForUpdate() {
        Long tenantId = tenantIdentity.currentTenantId();
        return repo.findByTenantId(tenantId)
            .orElseGet(() -> repo.save(TenantComplianceSettings.builder().tenantId(tenantId).build()));
    }

    @Transactional(readOnly = true)
    public ComplianceSettingsResponse get() {
        return toResponse(current());
    }

    @Transactional(readOnly = true)
    public ResidualRule residualRule() {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId == null) return ResidualRule.defaults();
        return repo.findByTenantId(tenantId).map(this::toRule).orElseGet(ResidualRule::defaults);
    }

    @Transactional
    public ComplianceSettingsResponse update(ComplianceSettingsRequest req) {
        TenantComplianceSettings s = currentForUpdate();
        if (req.getResidualAllDrop() != null) s.setResidualAllDrop(nonNegative(req.getResidualAllDrop(), "residualAllDrop"));
        if (req.getResidualMajorityDrop() != null) s.setResidualMajorityDrop(nonNegative(req.getResidualMajorityDrop(), "residualMajorityDrop"));
        if (req.getResidualFloor() != null) s.setResidualFloor(atLeastOne(req.getResidualFloor(), "residualFloor"));
        if (req.getResidualAxis() != null) s.setResidualAxis(oneOf(req.getResidualAxis(), AXES, "residualAxis"));
        if (req.getResidualTarget() != null) s.setResidualTarget(oneOf(req.getResidualTarget(), TARGETS, "residualTarget"));
        if (req.getControlDueSoonDays() != null) s.setControlDueSoonDays(nonNegative(req.getControlDueSoonDays(), "controlDueSoonDays"));
        if (req.getFindingDueSoonDays() != null) s.setFindingDueSoonDays(nonNegative(req.getFindingDueSoonDays(), "findingDueSoonDays"));
        if (req.getSlaCriticalDays() != null) s.setSlaCriticalDays(nonNegative(req.getSlaCriticalDays(), "slaCriticalDays"));
        if (req.getSlaHighDays() != null) s.setSlaHighDays(nonNegative(req.getSlaHighDays(), "slaHighDays"));
        if (req.getSlaMediumDays() != null) s.setSlaMediumDays(nonNegative(req.getSlaMediumDays(), "slaMediumDays"));
        if (req.getSlaLowDays() != null) s.setSlaLowDays(nonNegative(req.getSlaLowDays(), "slaLowDays"));
        if (req.getRequireControlTestReview() != null) s.setRequireControlTestReview(req.getRequireControlTestReview());
        if (req.getRequireFindingReview() != null) s.setRequireFindingReview(req.getRequireFindingReview());
        if (req.getComplianceTeamEmail() != null) s.setComplianceTeamEmail(normaliseEmail(req.getComplianceTeamEmail()));
        return toResponse(repo.save(s));
    }

    @Transactional(readOnly = true)
    public boolean requireControlTestReview() {
        Boolean v = current().getRequireControlTestReview();
        return v == null || v;
    }

    @Transactional(readOnly = true)
    public boolean requireFindingReview() {
        Boolean v = current().getRequireFindingReview();
        return v == null || v;
    }

    @Transactional(readOnly = true)
    public String complianceTeamEmail() {
        String v = current().getComplianceTeamEmail();
        return v == null || v.isBlank() ? null : v.trim();
    }

    private String normaliseEmail(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        int at = v.indexOf('@');
        if (at <= 0 || at == v.length() - 1 || v.contains(" "))
            throw ApiException.badRequest("invalid_setting", "complianceTeamEmail must be a valid email address");
        return v;
    }

    private int nonNegative(Integer value, String field) {
        if (value < 0) throw ApiException.badRequest("invalid_setting", field + " cannot be negative");
        return value;
    }

    private int atLeastOne(Integer value, String field) {
        if (value < 1) throw ApiException.badRequest("invalid_setting", field + " must be at least 1");
        return value;
    }

    private String oneOf(String value, List<String> allowed, String field) {
        for (String a : allowed) if (a.equalsIgnoreCase(value.trim())) return a;
        throw ApiException.badRequest("invalid_setting", field + " must be one of " + allowed);
    }

    private ResidualRule toRule(TenantComplianceSettings s) {
        return new ResidualRule(
            nz(s.getResidualAllDrop(), 2),
            nz(s.getResidualMajorityDrop(), 1),
            ResidualRule.parseAxis(s.getResidualAxis()),
            s.getResidualTarget() == null ? "Passed" : s.getResidualTarget(),
            s.getResidualFloor() == null || s.getResidualFloor() < 1 ? 1 : s.getResidualFloor());
    }

    private ComplianceSettingsResponse toResponse(TenantComplianceSettings s) {
        return ComplianceSettingsResponse.builder()
            .residualAllDrop(s.getResidualAllDrop())
            .residualMajorityDrop(s.getResidualMajorityDrop())
            .residualAxis(s.getResidualAxis())
            .residualTarget(s.getResidualTarget())
            .residualFloor(s.getResidualFloor())
            .controlDueSoonDays(s.getControlDueSoonDays())
            .findingDueSoonDays(s.getFindingDueSoonDays())
            .slaCriticalDays(s.getSlaCriticalDays())
            .slaHighDays(s.getSlaHighDays())
            .slaMediumDays(s.getSlaMediumDays())
            .slaLowDays(s.getSlaLowDays())
            .requireControlTestReview(s.getRequireControlTestReview() == null || s.getRequireControlTestReview())
            .requireFindingReview(s.getRequireFindingReview() == null || s.getRequireFindingReview())
            .complianceTeamEmail(s.getComplianceTeamEmail())
            .build();
    }

    private static int nz(Integer value, int fallback) { return value == null ? fallback : value; }
}
