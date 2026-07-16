package com.atheris.compliance.tenant.backend.modules.users.controller;

import com.atheris.compliance.tenant.backend.modules.users.dto.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.service.UserService;
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
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<List<UserDto>> list() {
        return ResponseEntity.ok(service.findAll());
    }

    @PostMapping("/invite")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<UserDto> invite(
            @Valid @RequestBody InviteUserRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.invite(req, u.getUserId()));
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<UserDto> updateRole(
            @PathVariable Integer id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(service.updateRole(id, body.get("role")));
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<Void> deactivate(@PathVariable Integer id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<UserDto> reactivate(@PathVariable Integer id) {
        return ResponseEntity.ok(service.reactivate(id));
    }
}
