package com.atheris.compliance.tenant.backend.modules.risks.controller;

import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskItem;
import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskStats;
import com.atheris.compliance.tenant.backend.modules.risks.service.RiskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/risks")
@RequiredArgsConstructor
public class RiskController {

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
}
