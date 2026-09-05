package com.atheris.compliance.intelligence.backend.modules.sanctions.controller;

import com.atheris.compliance.intelligence.backend.modules.sanctions.dto.AdminSanctionDetailDto;
import com.atheris.compliance.intelligence.backend.modules.sanctions.dto.AdminSanctionDto;
import com.atheris.compliance.intelligence.backend.modules.sanctions.service.AdminSanctionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/sanctions")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminSanctionController {

    private final AdminSanctionService service;

    @GetMapping
    public ResponseEntity<Page<AdminSanctionDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long regulationId,
            @RequestParam(required = false) String sanctionType,
            @RequestParam(required = false) Boolean hasBeenEnforced,
            @RequestParam(required = false) Integer minSeverity,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, regulationId, sanctionType, hasBeenEnforced, minSeverity, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminSanctionDetailDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
