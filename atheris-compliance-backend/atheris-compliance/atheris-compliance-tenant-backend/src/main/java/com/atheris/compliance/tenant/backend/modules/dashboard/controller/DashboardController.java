package com.atheris.compliance.tenant.backend.modules.dashboard.controller;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;

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

    @PostMapping("/refresh")
    public ResponseEntity<DashboardSnapshot> refresh() {
        return ResponseEntity.ok(service.computeAndStore());
    }
}
