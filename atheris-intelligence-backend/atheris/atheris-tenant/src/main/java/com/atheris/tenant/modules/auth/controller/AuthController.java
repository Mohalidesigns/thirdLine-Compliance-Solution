package com.atheris.tenant.modules.auth.controller;

import com.atheris.tenant.modules.auth.dto.*;
import com.atheris.tenant.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthTokens> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthTokens> refresh(@Valid @RequestBody RefreshRequest req) {
        return ResponseEntity.ok(authService.refresh(req.getRefreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequest req) {
        authService.logout(req.getRefreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invite/validate")
    public ResponseEntity<InviteValidationResult> validateInvite(@RequestParam String token) {
        return ResponseEntity.ok(authService.validateInviteToken(token));
    }

    @PostMapping("/invite/accept")
    public ResponseEntity<AuthTokens> acceptInvite(@Valid @RequestBody AcceptInviteRequest req) {
        return ResponseEntity.ok(authService.acceptInvite(req));
    }

    @PostMapping("/password/reset-request")
    public ResponseEntity<Map<String, String>> requestReset(@RequestBody Map<String, String> body) {
        authService.requestPasswordReset(body.get("email"));
        return ResponseEntity.ok(Map.of("message", "If that email exists, a reset link has been sent"));
    }

    @PostMapping("/password/reset")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        authService.resetPassword(req);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }
}
