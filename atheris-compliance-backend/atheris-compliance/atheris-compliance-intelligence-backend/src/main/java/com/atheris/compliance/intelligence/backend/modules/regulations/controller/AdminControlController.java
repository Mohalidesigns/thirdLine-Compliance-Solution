package com.atheris.compliance.intelligence.backend.modules.regulations.controller;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.AdminControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/controls")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminControlController {

    private final AdminControlService service;

    @GetMapping
    public ResponseEntity<Page<AdminControlDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long actId,
            @RequestParam(required = false) String theme,
            @RequestParam(required = false) String complianceArea,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(required = false) String status,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, actId, theme, complianceArea, riskLevel, status, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminControlDetailDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
