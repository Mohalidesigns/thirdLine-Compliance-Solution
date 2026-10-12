package com.atheris.compliance.tenant.backend.modules.acts.controller;

import com.atheris.compliance.tenant.backend.modules.acts.dto.ActDetailResponse;
import com.atheris.compliance.tenant.backend.modules.acts.dto.ActListItem;
import com.atheris.compliance.tenant.backend.modules.acts.dto.ActStatsDto;
import com.atheris.compliance.tenant.backend.modules.acts.service.ActService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/acts")
@RequiredArgsConstructor
public class ActController {

    private final ActService service;

    @GetMapping
    public ResponseEntity<Page<ActListItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String regulator,
            Pageable p) {
        return ResponseEntity.ok(service.list(q, regulator, p));
    }

    @GetMapping("/stats")
    public ResponseEntity<ActStatsDto> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ActDetailResponse> detail(@PathVariable Integer id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
