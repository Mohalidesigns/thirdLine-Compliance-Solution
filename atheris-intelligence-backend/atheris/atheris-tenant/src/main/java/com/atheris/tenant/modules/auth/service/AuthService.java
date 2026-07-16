package com.atheris.tenant.modules.auth.service;

import com.atheris.tenant.modules.auth.dto.*;
import com.atheris.tenant.modules.auth.entity.*;
import com.atheris.tenant.modules.auth.repository.*;
import com.atheris.tenant.modules.users.entity.User;
import com.atheris.tenant.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository users;
    private final InviteTokenRepository inviteTokens;
    private final RefreshTokenRepository refreshTokens;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    private static final int INVITE_EXPIRY_HOURS = 72;
    private static final int RESET_EXPIRY_HOURS = 1;
    private static final int MAX_FAILED = 5;
    private static final int LOCKOUT_MINUTES = 15;
    private static final int REFRESH_DAYS = 30;

    public InviteValidationResult validateInviteToken(String raw) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(raw))
            .orElseThrow(() -> new RuntimeException("Invalid invite link"));
        if (t.getIsUsed()) throw new RuntimeException("Invite already used");
        if (Instant.now().isAfter(t.getExpiresAt())) throw new RuntimeException("Invite link expired");
        User u = users.findById(t.getUserId()).orElseThrow();
        return InviteValidationResult.builder()
            .email(u.getEmail()).fullName(u.getFullName()).role(u.getRole()).tokenValid(true).build();
    }

    @Transactional
    public AuthTokens acceptInvite(AcceptInviteRequest req) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(req.getToken()))
            .orElseThrow(() -> new RuntimeException("Invalid invite"));
        if (t.getIsUsed()) throw new RuntimeException("Invite already used");
        if (Instant.now().isAfter(t.getExpiresAt())) throw new RuntimeException("Invite expired");
        if (!req.getPassword().equals(req.getConfirmPassword()))
            throw new RuntimeException("Passwords do not match");
        validatePw(req.getPassword());
        User u = users.findById(t.getUserId()).orElseThrow();
        u.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        u.setPasswordChangedAt(Instant.now());
        u.setInviteStatus("active");
        u.setEmailVerified(true);
        users.save(u);
        t.setIsUsed(true);
        t.setUsedAt(Instant.now());
        inviteTokens.save(t);
        return issueTokens(u, req.getDeviceName(), req.getIpAddress());
    }

    @Transactional
    public AuthTokens login(LoginRequest req) {
        User u = users.findByEmail(req.getEmail().toLowerCase())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        if (!u.getIsActive()) throw new RuntimeException("Account deactivated");
        if ("pending".equals(u.getInviteStatus()))
            throw new RuntimeException("Please accept your invite first");
        if (u.getLockedUntil() != null && Instant.now().isBefore(u.getLockedUntil()))
            throw new RuntimeException("Account locked");
        if (!passwordEncoder.matches(req.getPassword(), u.getPasswordHash())) {
            if (u.getFailedLoginAttempts() + 1 >= MAX_FAILED) {
                u.setLockedUntil(Instant.now().plus(LOCKOUT_MINUTES, ChronoUnit.MINUTES));
                users.save(u);
            } else
                users.incrementFailedAttempts(u.getUserId());
            throw new RuntimeException("Invalid email or password");
        }
        u.setFailedLoginAttempts(0);
        u.setLockedUntil(null);
        u.setLastLoginAt(Instant.now());
        u.setLastLoginIp(req.getIpAddress());
        users.save(u);
        return issueTokens(u, req.getDeviceName(), req.getIpAddress());
    }

    @Transactional
    public AuthTokens refresh(String raw) {
        RefreshToken t = refreshTokens.findByTokenHash(sha256(raw))
            .orElseThrow(() -> new RuntimeException("Invalid refresh token"));
        if (t.getIsRevoked()) throw new RuntimeException("Token revoked");
        if (Instant.now().isAfter(t.getExpiresAt())) throw new RuntimeException("Token expired");
        User u = users.findById(t.getUserId()).orElseThrow();
        t.setIsRevoked(true);
        t.setRevokedAt(Instant.now());
        t.setRevokedReason("rotated");
        refreshTokens.save(t);
        return issueTokens(u, t.getDeviceName(), t.getIpAddress());
    }

    @Transactional
    public void logout(String raw) {
        refreshTokens.findByTokenHash(sha256(raw)).ifPresent(t -> {
            t.setIsRevoked(true);
            t.setRevokedAt(Instant.now());
            t.setRevokedReason("logout");
            refreshTokens.save(t);
        });
    }

    @Transactional
    public void requestPasswordReset(String email) {
        users.findByEmail(email.toLowerCase()).ifPresent(u -> {
            if (!u.getIsActive()) return;
            String raw = generateToken();
            inviteTokens.save(InviteToken.builder()
                .userId(u.getUserId()).token(raw).tokenHash(sha256(raw))
                .tokenType("password_reset")
                .expiresAt(Instant.now().plus(RESET_EXPIRY_HOURS, ChronoUnit.HOURS))
                .build());
            log.info("Password reset created for {}", email);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(req.getToken()))
            .orElseThrow(() -> new RuntimeException("Invalid reset link"));
        if (t.getIsUsed()) throw new RuntimeException("Reset link already used");
        if (Instant.now().isAfter(t.getExpiresAt())) throw new RuntimeException("Reset link expired");
        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw new RuntimeException("Passwords do not match");
        validatePw(req.getNewPassword());
        User u = users.findById(t.getUserId()).orElseThrow();
        u.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        u.setPasswordChangedAt(Instant.now());
        users.save(u);
        refreshTokens.findByUserIdAndIsRevokedFalse(t.getUserId()).forEach(rt -> {
            rt.setIsRevoked(true);
            rt.setRevokedAt(Instant.now());
            rt.setRevokedReason("password_reset");
            refreshTokens.save(rt);
        });
        t.setIsUsed(true);
        t.setUsedAt(Instant.now());
        inviteTokens.save(t);
    }

    private AuthTokens issueTokens(User u, String device, String ip) {
        String access = jwtService.generateAccessToken(u.getUserId(), u.getEmail(), u.getRole());
        String raw = generateToken();
        refreshTokens.save(RefreshToken.builder()
            .userId(u.getUserId()).tokenHash(sha256(raw))
            .deviceName(device).ipAddress(ip)
            .isRevoked(false)
            .expiresAt(Instant.now().plus(REFRESH_DAYS, ChronoUnit.DAYS))
            .build());
        return AuthTokens.builder()
            .accessToken(access).refreshToken(raw)
            .accessTokenExpiresIn(1440)
            .tokenType("Bearer")
            .user(AuthTokens.UserSummary.builder()
                .userId(u.getUserId()).email(u.getEmail())
                .fullName(u.getFullName()).role(u.getRole()).build())
            .build();
    }

    private void validatePw(String pw) {
        if (pw == null || pw.length() < 8)
            throw new RuntimeException("Password must be at least 8 characters");
        if (!pw.matches(".*[A-Z].*"))
            throw new RuntimeException("Password must contain an uppercase letter");
        if (!pw.matches(".*[0-9].*"))
            throw new RuntimeException("Password must contain a number");
        if (!pw.matches(".*[^a-zA-Z0-9].*"))
            throw new RuntimeException("Password must contain a special character");
    }

    private String generateToken() {
        byte[] b = new byte[96];
        new SecureRandom().nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    private String sha256(String s) {
        try {
            return HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
