package com.atheris.compliance.intelligence.backend.modules.regulations.controller;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.RegulationService;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.ToolkitImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/acts")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminRegulationController {

    private final RegulationService service;
    private final ToolkitImportService toolkitImport;

    @GetMapping
    public ResponseEntity<Page<RegulationDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer regulatorId,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, regulatorId, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RegulationDetailDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegulationDto> update(@PathVariable Long id, @RequestBody RegulationDto req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PostMapping("/toolkit/import")
    public ResponseEntity<Map<String, Object>> importToolkit() {
        return ResponseEntity.ok(toolkitImport.importToolkit());
    }
}