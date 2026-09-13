package com.atheris.compliance.intelligence.backend.modules.obligations.controller;

import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerDetail;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerItem;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerStats;
import com.atheris.compliance.intelligence.backend.modules.obligations.service.ObligationExplorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/obligations")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminObligationExplorerController {

    private final ObligationExplorerService service;

    @GetMapping
    public ResponseEntity<Page<ObligationExplorerItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String risk,
            @RequestParam(required = false) Integer regulatorId,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) Long actId,
            @RequestParam(required = false) Boolean hasPoints,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(q, risk, regulatorId, areaOfFocus, actId, hasPoints, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<ObligationExplorerStats> stats() {
        return ResponseEntity.ok(service.getStats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObligationExplorerDetail> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @GetMapping("/{id}/controls")
    public ResponseEntity<List<?>> controls(@PathVariable Long id) {
        ObligationExplorerDetail detail = service.getDetail(id);
        return ResponseEntity.ok(detail.getLinkedControls());
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<URI> pdf(@PathVariable Long id) {
        ObligationExplorerDetail detail = service.getDetail(id);
        if (detail.getInstrument() != null && detail.getInstrument().getPdfUrl() != null) {
            return ResponseEntity.ok(URI.create(detail.getInstrument().getPdfUrl()));
        }
        return ResponseEntity.notFound().build();
    }
}
