package com.atheris.compliance.tenant.backend.modules.findings.controller;

import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
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

    @GetMapping("/stats")
    public ResponseEntity<FindingStatsDto> stats() {
        return ResponseEntity.ok(service.getStats());
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
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FindingRaisedResponse> raise(
            @Valid @RequestBody RaiseFindingRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.manualRaise(req, u.getUserId()));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FindingDetailResponse> assign(
            @PathVariable Long id,
            @Valid @RequestBody RaiseRemediationRequest req,
            @AuthenticationPrincipal User u) {
        service.assign(id, req, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    /**
     * Submit remediation in-app. Used by owners who have a login; owners without one use
     * the public remediation link. An Analyst records remediation; the CCO is not part of it.
     */
    @PutMapping("/{id}/remediate")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FindingDetailResponse> remediate(
            @PathVariable Long id,
            @Valid @RequestBody SubmitRemediationRequest req,
            @AuthenticationPrincipal User u) {
        service.submitRemediation(id, req, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    /**
     * Approve or reject a submitted remediation. An Analyst, CCO or Tenant Admin may sign off;
     * the signer must not be the person who submitted it. No CCO-only step.
     */
    @PutMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FindingDetailResponse> review(
            @PathVariable Long id,
            @RequestParam String decision,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal User u) {
        service.reviewRemediation(id, decision, notes, u);
        return ResponseEntity.ok(service.getDetail(id));
    }
}
