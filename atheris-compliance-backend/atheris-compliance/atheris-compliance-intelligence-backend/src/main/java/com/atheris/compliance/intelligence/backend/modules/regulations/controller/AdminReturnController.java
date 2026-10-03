package com.atheris.compliance.intelligence.backend.modules.regulations.controller;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.AdminReturnService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/returns")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminReturnController {

    private final AdminReturnService service;

    @GetMapping
    public ResponseEntity<Page<AdminReturnDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long actId,
            @RequestParam(required = false) String frequencyType,
            @RequestParam(required = false) String responsibleUnit,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, actId, frequencyType, responsibleUnit, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminReturnDetailDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
