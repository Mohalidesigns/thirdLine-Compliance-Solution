package com.atheris.compliance.tenant.backend.modules.findings.controller;

import com.atheris.compliance.tenant.backend.modules.findings.dto.*;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/findings")
@RequiredArgsConstructor
public class FindingController {

    private final FindingService service;

    @GetMapping
    public ResponseEntity<List<Finding>> list(@RequestParam(required = false) String status) {
        if (status != null) return ResponseEntity.ok(service.findByStatus(status));
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/open")
    public ResponseEntity<List<Finding>> open() {
        return ResponseEntity.ok(service.findOpen());
    }

    @GetMapping("/overdue")
    public ResponseEntity<List<Finding>> overdue() {
        return ResponseEntity.ok(service.findOverdue());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Finding> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<Finding> raise(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.manualRaise(
                body.get("description"), body.get("severity"),
                body.get("finding_type"), u.getUserId()));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<Finding> assign(
            @PathVariable Long id,
            @Valid @RequestBody RaiseRemediationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.assign(id, req, u.getUserId()));
    }

    @PutMapping("/{id}/remediate")
    public ResponseEntity<Finding> remediate(
            @PathVariable Long id,
            @Valid @RequestBody SubmitRemediationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.submitRemediation(id, req, u.getUserId()));
    }

    @PutMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Finding> close(
            @PathVariable Long id,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.close(id, u.getUserId()));
    }
}
