package com.atheris.compliance.tenant.backend.modules.dashboard.controller;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.*;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.DashboardV2Service;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/dashboard/v2")
@RequiredArgsConstructor
public class DashboardV2Controller {

    private final DashboardV2Service service;

    @GetMapping("/returns-by-period")
    public ResponseEntity<ReturnsByPeriodDto> returnsByPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(service.getReturnsByPeriod(from, to));
    }

    @GetMapping("/control-coverage")
    public ResponseEntity<ControlCoverageDto> controlCoverage(
            @RequestParam(defaultValue = "areaOfFocus") String by) {
        return switch (by) {
            case "department" -> ResponseEntity.ok(service.getControlCoverageByDepartment());
            default -> ResponseEntity.ok(service.getControlCoverageByAreaOfFocus());
        };
    }

    @GetMapping("/risk-profile")
    public ResponseEntity<RiskProfileDto> riskProfile() {
        return ResponseEntity.ok(service.getRiskProfile());
    }

    @GetMapping("/rendition-grid")
    public ResponseEntity<RenditionGridDto> renditionGrid(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "department") String groupBy) {
        return ResponseEntity.ok(service.getRenditionGrid(from, to, groupBy));
    }

    @GetMapping("/risk-heatmap")
    public ResponseEntity<RiskHeatmapDto> riskHeatmap(
            @RequestParam(defaultValue = "inherent") String view) {
        return ResponseEntity.ok(service.getRiskHeatmap(view));
    }

    @GetMapping("/escalation-matrix")
    public ResponseEntity<EscalationMatrixDto> escalationMatrix() {
        return ResponseEntity.ok(service.getEscalationMatrix());
    }

    @GetMapping("/thresholds")
    public ResponseEntity<ThresholdDto> getThresholds(@RequestParam Long tenantId) {
        return ResponseEntity.ok(service.getThresholds(tenantId));
    }

    @PutMapping("/thresholds")
    public ResponseEntity<Void> saveThresholds(@RequestParam Long tenantId,
                                                @RequestBody ThresholdDto dto) {
        service.saveThresholds(tenantId, dto);
        return ResponseEntity.ok().build();
    }
}
