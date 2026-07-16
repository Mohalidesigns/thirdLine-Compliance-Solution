package com.atheris.compliance.tenant.backend.modules.controls.controller;

import com.atheris.compliance.tenant.backend.modules.controls.dto.*;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/controls")
@RequiredArgsConstructor
public class ControlController {

    private final ControlService service;

    @GetMapping
    public ResponseEntity<List<ControlDto>> list(
            @RequestParam(required = false) String theme,
            @RequestParam(required = false) Integer ownerId) {
        if (theme != null) return ResponseEntity.ok(service.findByTheme(theme));
        if (ownerId != null) return ResponseEntity.ok(service.findByOwner(ownerId));
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/high-risk")
    public ResponseEntity<List<ControlDto>> highRisk() {
        return ResponseEntity.ok(service.findHighRisk());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ControlDto> getOne(@PathVariable Integer id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<ControlDto> create(
            @Valid @RequestBody CreateControlRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, u.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<ControlDto> update(
            @PathVariable Integer id,
            @RequestBody CreateControlRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.update(id, req, u.getUserId()));
    }
}
