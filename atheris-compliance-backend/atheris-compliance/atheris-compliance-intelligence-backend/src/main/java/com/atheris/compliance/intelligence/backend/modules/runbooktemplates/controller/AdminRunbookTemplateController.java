package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.controller;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateDto;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateStatsDto;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service.RunbookTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Read-only runbook template explorer for platform admins. */
@RestController
@RequestMapping("/api/v1/admin/runbook-templates")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminRunbookTemplateController {

    private final RunbookTemplateService service;

    @GetMapping
    public ResponseEntity<Page<RunbookTemplateDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String criticality,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "templateCode", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(service.list(q, category, criticality, status, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<RunbookTemplateStatsDto> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{code}")
    public ResponseEntity<RunbookTemplateDto> detail(@PathVariable String code) {
        return ResponseEntity.ok(service.detail(code));
    }
}
