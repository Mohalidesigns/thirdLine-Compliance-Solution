package com.atheris.compliance.tenant.backend.modules.controls.controller;

import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlThemeDto;
import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlThemeRequest;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlThemeService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/control-themes")
@RequiredArgsConstructor
public class ControlThemeController {

    private final ControlThemeService service;

    @GetMapping
    public ResponseEntity<List<ControlThemeDto>> list(@RequestParam(required = false, defaultValue = "true") boolean activeOnly) {
        return ResponseEntity.ok(service.list(activeOnly));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ControlThemeDto> create(@RequestBody ControlThemeRequest req,
                                                  @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.create(req, u == null ? null : u.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ControlThemeDto> update(@PathVariable Integer id,
                                                  @RequestBody ControlThemeRequest req,
                                                  @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.update(id, req, u == null ? null : u.getUserId()));
    }

    @PutMapping("/{id}/disable")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> disable(@PathVariable Integer id, @AuthenticationPrincipal User u) {
        service.disable(id, u == null ? null : u.getUserId());
        return ResponseEntity.noContent().build();
    }
}
