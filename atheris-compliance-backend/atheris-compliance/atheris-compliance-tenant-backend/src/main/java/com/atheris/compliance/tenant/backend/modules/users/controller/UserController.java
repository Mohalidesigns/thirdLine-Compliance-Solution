package com.atheris.compliance.tenant.backend.modules.users.controller;

import com.atheris.compliance.tenant.backend.modules.users.dto.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.service.UserService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService service;

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.findById(u.getUserId()));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal User u,
            @Valid @RequestBody ChangePasswordRequest req) {
        service.changePassword(u.getUserId(), req);
        return ResponseEntity.ok(Map.of("message", "Password changed"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<List<UserDto>> list(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(service.findAll(q));
    }

    @PostMapping("/invite")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<UserDto> invite(
            @Valid @RequestBody InviteUserRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.invite(req, u.getUserId()));
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<UserDto> updateRole(
            @PathVariable Integer id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(service.updateRole(id, body.get("role")));
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> deactivate(@PathVariable Integer id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    /** Assign a manager (escalation target for level-2 notifications). */
    @PutMapping("/{id}/manager")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<UserDto> updateManager(
            @PathVariable Integer id,
            @RequestBody Map<String, Object> body) {
        Object raw = body.get("managerUserId");
        Integer managerUserId = raw == null || "".equals(raw) ? null : Integer.valueOf(String.valueOf(raw));
        return ResponseEntity.ok(service.updateManager(id, managerUserId));
    }

    @PutMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<UserDto> reactivate(@PathVariable Integer id) {
        return ResponseEntity.ok(service.reactivate(id));
    }
}
