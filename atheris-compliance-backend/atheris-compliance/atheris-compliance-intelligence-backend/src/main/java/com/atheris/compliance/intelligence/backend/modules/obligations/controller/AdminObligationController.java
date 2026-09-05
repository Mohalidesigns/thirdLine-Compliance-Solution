package com.atheris.compliance.intelligence.backend.modules.obligations.controller;

import com.atheris.compliance.intelligence.backend.modules.obligations.dto.AdminObligationDetailDto;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.AdminObligationDto;
import com.atheris.compliance.intelligence.backend.modules.obligations.service.AdminObligationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/obligations")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminObligationController {

    private final AdminObligationService service;

    @GetMapping
    public ResponseEntity<Page<AdminObligationDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long regulationId,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) String inherentRiskRating,
            @RequestParam(required = false) String obligationType,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, regulationId, areaOfFocus, inherentRiskRating, obligationType, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminObligationDetailDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
