package com.atheris.platform.modules.auth.controller;

import com.atheris.platform.modules.auth.dto.*;
import com.atheris.platform.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        LoginResponse res = authService.authenticate(req.getEmail(), req.getPassword());
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDto> me(Authentication auth) {
        return ResponseEntity.ok(authService.getCurrentUser(auth));
    }
}
