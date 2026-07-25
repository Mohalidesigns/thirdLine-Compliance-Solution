package com.atheris.compliance.tenant.backend.modules.returns.controller;

import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService service;

    @GetMapping("/calendar")
    public ResponseEntity<Page<ReturnInstanceItem>> calendar(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) Long returnId,
            @RequestParam(required = false) String status,
            Pageable p) {
        return ResponseEntity.ok(service.getCalendar(period, returnId, status, p));
    }

    @GetMapping("/instances/{id}/detail")
    public ResponseEntity<ReturnInstanceDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/instances/{id}/advance")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> advance(
            @PathVariable Long id,
            @Valid @RequestBody AdvanceStageRequest req,
            @AuthenticationPrincipal User u) {
        service.advanceStage(id, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/instances/{id}/submit")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> submit(
            @PathVariable Long id,
            @RequestBody AdvanceStageRequest req,
            @AuthenticationPrincipal User u) {
        service.submit(id, req.getEvidenceUrl(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Long> create(
            @Valid @RequestBody CreateReturnRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(req, u.getUserId()).getReturnId());
    }
}
