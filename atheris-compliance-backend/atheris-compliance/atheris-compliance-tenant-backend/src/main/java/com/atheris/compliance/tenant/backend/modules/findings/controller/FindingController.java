package com.atheris.compliance.tenant.backend.modules.findings.controller;

import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/findings")
@RequiredArgsConstructor
public class FindingController {

    private final FindingService service;

    @GetMapping("/register")
    public ResponseEntity<Page<FindingRegisterItem>> register(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) Boolean overdueOnly,
            @RequestParam(required = false) Integer assignedToUserId,
            Pageable p) {
        return ResponseEntity.ok(service.getRegisterList(status, severity, overdueOnly, assignedToUserId, p));
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<FindingDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FindingDetailResponse> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<FindingRaisedResponse> raise(
            @Valid @RequestBody RaiseFindingRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.manualRaise(req, u.getUserId()));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<FindingDetailResponse> assign(
            @PathVariable Long id,
            @Valid @RequestBody RaiseRemediationRequest req,
            @AuthenticationPrincipal User u) {
        service.assign(id, req, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/{id}/remediate")
    public ResponseEntity<FindingDetailResponse> remediate(
            @PathVariable Long id,
            @Valid @RequestBody SubmitRemediationRequest req,
            @AuthenticationPrincipal User u) {
        service.submitRemediation(id, req, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<FindingDetailResponse> close(
            @PathVariable Long id,
            @AuthenticationPrincipal User u) {
        service.close(id, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }
}
