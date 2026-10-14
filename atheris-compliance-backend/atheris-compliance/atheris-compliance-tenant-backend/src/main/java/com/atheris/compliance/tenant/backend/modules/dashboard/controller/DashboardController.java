package com.atheris.compliance.tenant.backend.modules.dashboard.controller;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ScoreWeightsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.ComplianceMetricsService;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.DashboardService;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.ScoreWeightsService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;
    private final ComplianceMetricsService metrics;
    private final ScoreWeightsService scoreWeights;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSnapshot> summary() {
        return ResponseEntity.ok(service.getLatest());
    }

    @GetMapping("/trends")
    public ResponseEntity<List<DashboardSnapshot>> trends() {
        return ResponseEntity.ok(service.getTrend());
    }

    @GetMapping("/attention-items")
    public ResponseEntity<Map<String, Object>> attentionItems() {
        return ResponseEntity.ok(service.getAttentionItems());
    }

    /** Canonical, period-aware metrics (source of truth for the dashboards and the board pack). */
    @GetMapping("/metrics")
    public ResponseEntity<ComplianceMetricsDto> metrics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(metrics.compute(from, to));
    }

    @PostMapping("/refresh")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<DashboardSnapshot> refresh() {
        return ResponseEntity.ok(service.computeAndStore());
    }

    @GetMapping("/score-weights")
    public ResponseEntity<ScoreWeightsDto> getScoreWeights() {
        return ResponseEntity.ok(scoreWeights.get());
    }

    @PutMapping("/score-weights")
    @PreAuthorize("hasRole('" + AppRole.CCO + "')")
    public ResponseEntity<ScoreWeightsDto> saveScoreWeights(@RequestBody ScoreWeightsDto dto) {
        return ResponseEntity.ok(scoreWeights.save(dto));
    }
}