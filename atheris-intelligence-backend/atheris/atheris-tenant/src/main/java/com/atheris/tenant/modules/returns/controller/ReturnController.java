package com.atheris.tenant.modules.returns.controller;

import com.atheris.tenant.modules.returns.entity.*;
import com.atheris.tenant.modules.returns.service.ReturnService;
import com.atheris.tenant.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService service;

    @GetMapping
    public ResponseEntity<List<RegulatoryReturn>> list() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/calendar")
    public ResponseEntity<List<ReturnFilingInstance>> calendar(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(service.getCalendar(days));
    }

    @GetMapping("/overdue")
    public ResponseEntity<List<ReturnFilingInstance>> overdue() {
        return ResponseEntity.ok(service.getOverdue());
    }

    @GetMapping("/{id}/instances")
    public ResponseEntity<List<ReturnFilingInstance>> instances(@PathVariable Long id) {
        return ResponseEntity.ok(service.getInstances(id));
    }

    @PutMapping("/{id}/instances/{iid}/advance")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<ReturnFilingInstance> advance(
            @PathVariable Long id,
            @PathVariable Long iid,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.advanceStage(iid, u.getUserId()));
    }

    @PutMapping("/{id}/instances/{iid}/submit")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<ReturnFilingInstance> submit(
            @PathVariable Long id,
            @PathVariable Long iid,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(
            service.submit(iid, body.get("evidence_url"), u.getUserId()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<RegulatoryReturn> create(
            @RequestBody RegulatoryReturn req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(req, u.getUserId()));
    }
}
