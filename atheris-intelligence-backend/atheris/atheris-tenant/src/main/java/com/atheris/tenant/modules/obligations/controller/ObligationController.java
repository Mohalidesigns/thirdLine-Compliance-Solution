package com.atheris.tenant.modules.obligations.controller;

import com.atheris.tenant.modules.obligations.dto.*;
import com.atheris.tenant.modules.obligations.service.ObligationService;
import com.atheris.tenant.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/obligations")
@RequiredArgsConstructor
public class ObligationController {

    private final ObligationService service;

    @GetMapping
    public ResponseEntity<Page<ObligationClassificationDto>> list(
            @RequestParam(required = false) String applicability,
            @RequestParam(required = false) String status,
            Pageable p) {
        return ResponseEntity.ok(service.findAll(applicability, status, p));
    }

    @GetMapping("/inbox")
    public ResponseEntity<Page<ObligationClassificationDto>> inbox(Pageable p) {
        return ResponseEntity.ok(service.getInbox(p));
    }

    @GetMapping("/gaps")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN','ANALYST')")
    public ResponseEntity<List<ObligationClassificationDto>> gaps() {
        return ResponseEntity.ok(service.getGaps());
    }

    @GetMapping("/pending-approval")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<List<ObligationClassificationDto>> pendingApproval() {
        return ResponseEntity.ok(service.getHighRiskPendingApproval());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObligationClassificationDto> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.findByInstrumentId(id));
    }

    @PostMapping("/{id}/classify")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<ObligationClassificationDto> classify(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.classify(id, req, u.getUserId()));
    }

    @PutMapping("/{id}/classify")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<ObligationClassificationDto> update(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.classify(id, req, u.getUserId()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<ObligationClassificationDto> approve(
            @PathVariable Long id,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.ccoApprove(id, u.getUserId()));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<?>> history(@PathVariable Long id) {
        return ResponseEntity.ok(service.getHistory(id));
    }
}
