package com.atheris.compliance.tenant.backend.modules.risks.controller;

import com.atheris.compliance.tenant.backend.modules.risks.dto.CreateRiskRequest;
import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskItem;
import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskStats;
import com.atheris.compliance.tenant.backend.modules.risks.dto.UpdateRiskRequest;
import com.atheris.compliance.tenant.backend.modules.risks.service.RiskService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/risks")
@RequiredArgsConstructor
public class RiskController {

    private static final String WRITERS =
        "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')";

    private final RiskService service;

    @GetMapping
    public ResponseEntity<List<RiskItem>> register(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String band,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(service.register(q, band, status));
    }

    @GetMapping("/stats")
    public ResponseEntity<RiskStats> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RiskItem> detail(@PathVariable Integer id) {
        return ResponseEntity.ok(service.detail(id));
    }

    @PostMapping
    @PreAuthorize(WRITERS)
    public ResponseEntity<RiskItem> create(@RequestBody CreateRiskRequest req, @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.create(req, u.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITERS)
    public ResponseEntity<RiskItem> update(@PathVariable Integer id, @RequestBody UpdateRiskRequest req,
                                           @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.update(id, req, u.getUserId()));
    }
}
