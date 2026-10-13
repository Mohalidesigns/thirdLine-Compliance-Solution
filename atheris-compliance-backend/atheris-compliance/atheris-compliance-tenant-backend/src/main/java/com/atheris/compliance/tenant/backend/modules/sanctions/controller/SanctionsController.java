package com.atheris.compliance.tenant.backend.modules.sanctions.controller;

import com.atheris.compliance.tenant.backend.modules.sanctions.dto.SanctionListItem;
import com.atheris.compliance.tenant.backend.modules.sanctions.dto.SanctionStatsDto;
import com.atheris.compliance.tenant.backend.modules.sanctions.service.SanctionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/sanctions")
@RequiredArgsConstructor
public class SanctionsController {

    private final SanctionService service;

    @GetMapping
    public ResponseEntity<Page<SanctionListItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sanctionType,
            @RequestParam(required = false) String actName,
            @RequestParam(required = false) Boolean enforced,
            @RequestParam(required = false) Long regulationId,
            @RequestParam(required = false) String penaltyType,
            @RequestParam(required = false) String liableRole,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) Boolean hasBeenEnforced,
            @RequestParam(required = false) Integer minSeverity,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, sanctionType, actName, enforced, regulationId, penaltyType,
            liableRole, minAmount, maxAmount, hasBeenEnforced, minSeverity, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<SanctionStatsDto> stats() {
        return ResponseEntity.ok(service.stats());
    }
}