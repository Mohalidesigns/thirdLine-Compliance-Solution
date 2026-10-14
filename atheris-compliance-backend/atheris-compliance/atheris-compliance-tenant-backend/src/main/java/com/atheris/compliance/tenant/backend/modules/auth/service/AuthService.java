package com.atheris.compliance.tenant.backend.modules.auth.service;

import com.atheris.compliance.tenant.backend.modules.auth.dto.*;
import com.atheris.compliance.tenant.backend.modules.auth.entity.*;
import com.atheris.compliance.tenant.backend.modules.auth.repository.*;
import com.atheris.compliance.tenant.backend.modules.ldap.service.LdapAuthService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.exception.LoginFailedException;
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
    private final LdapAuthService ldapAuth;

    private static final int INVITE_EXPIRY_HOURS = 72;
    private static final int RESET_EXPIRY_HOURS = 1;
    private static final int MAX_FAILED = 5;
    private static final int LOCKOUT_MINUTES = 15;
    private static final int REFRESH_DAYS = 30;
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_PENDING = "pending";

    public InviteValidationResult validateInviteToken(String raw) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(raw))
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid invite link"));
        if (t.getIsUsed()) {
            throw ApiException.conflict("token_used", "Invite already used");
        }
        if (Instant.now().isAfter(t.getExpiresAt())) {
            throw ApiException.gone("token_expired", "Invite link expired");
        }
        User u = users.findById(t.getUserId())
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid invite link"));
        return InviteValidationResult.builder()
            .email(u.getEmail())
            .fullName(u.getFullName())
            .role(u.getRole())
            .tokenValid(true)
            .build();
    }

    @Transactional
    public AuthTokens acceptInvite(AcceptInviteRequest req) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(req.getToken()))
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid invite"));
        if (t.getIsUsed()) {
            throw ApiException.conflict("token_used", "Invite already used");
        }
        if (Instant.now().isAfter(t.getExpiresAt())) {
            throw ApiException.gone("token_expired", "Invite expired");
        }
        if (req.getPassword() == null || !req.getPassword().equals(req.getConfirmPassword())) {
            throw ApiException.badRequest("password_mismatch", "Passwords do not match");
        }
        validatePw(req.getPassword());
        User u = users.findById(t.getUserId())
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid invite"));
        u.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        u.setPasswordChangedAt(Instant.now());
        u.setInviteStatus(STATUS_ACTIVE);
        u.setEmailVerified(true);
        users.save(u);
        t.setIsUsed(true);
        t.setUsedAt(Instant.now());
        inviteTokens.save(t);
        return issueTokens(u, req.getDeviceName(), req.getIpAddress());
    }

    // A refused login must still commit the failed-attempt counter and lockout it just wrote.
    @Transactional(noRollbackFor = LoginFailedException.class)
    public AuthTokens login(LoginRequest req) {
        User user = users.findByEmail(req.getEmail().toLowerCase())
            .orElseThrow(LoginFailedException::invalidCredentials);

        if (!user.getIsActive()) {
            throw LoginFailedException.blocked("Account deactivated");
        }
        if (STATUS_PENDING.equals(user.getInviteStatus())) {
            throw LoginFailedException.blocked("Please accept your invite first");
        }
        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            throw LoginFailedException.blocked("Account locked");
        }

        if (usesLocalPassword(user)) {
            verifyLocalPassword(user, req.getPassword());
        } else {
            verifyDirectoryPassword(user, req.getPassword());
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        user.setLastLoginIp(req.getIpAddress());
        users.save(user);

        return issueTokens(user, req.getDeviceName(), req.getIpAddress());
    }

    // A break-glass admin always signs in locally; otherwise the tenant's mode decides.
    private boolean usesLocalPassword(User user) {
        if (Boolean.TRUE.equals(user.getIsBreakGlass())) {
            return true;
        }
        return !ldapAuth.isLdapEnabled();
    }

    private void verifyLocalPassword(User user, String rawPassword) {
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            recordFailedAttempt(user);
            throw LoginFailedException.invalidCredentials();
        }
    }

    private void verifyDirectoryPassword(User user, String rawPassword) {
        LdapAuthService.LdapResult result = ldapAuth.authenticate(user.getEmail(), rawPassword);
        if (result.status() == LdapAuthService.Status.UNAVAILABLE) {
            throw LoginFailedException.blocked(result.message());
        }
        if (!result.ok()) {
            recordFailedAttempt(user);
            throw LoginFailedException.invalidCredentials();
        }
        if (result.fullName() != null && !result.fullName().isBlank()
                && !result.fullName().equals(user.getFullName())) {
            user.setFullName(result.fullName());
        }
    }

    private void recordFailedAttempt(User user) {
        int previous = user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0;
        if (previous + 1 >= MAX_FAILED) {
            user.setLockedUntil(Instant.now().plus(LOCKOUT_MINUTES, ChronoUnit.MINUTES));
        } else {
            user.setFailedLoginAttempts(previous + 1);
        }
        users.save(user);
    }

    @Transactional
    public AuthTokens refresh(String raw) {
        RefreshToken t = refreshTokens.findByTokenHash(sha256(raw))
            .orElseThrow(() -> ApiException.unauthorized("invalid_refresh_token", "Invalid refresh token"));
        if (t.getIsRevoked()) {
            throw ApiException.unauthorized("refresh_token_revoked", "Token revoked");
        }
        if (Instant.now().isAfter(t.getExpiresAt())) {
            throw ApiException.unauthorized("refresh_token_expired", "Token expired");
        }
        User u = users.findById(t.getUserId())
            .orElseThrow(() -> ApiException.unauthorized("invalid_refresh_token", "Invalid refresh token"));
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
            if (!u.getIsActive()) {
                return;
            }
            String raw = generateToken();
            inviteTokens.save(InviteToken.builder()
                .userId(u.getUserId())
                .token(raw)
                .tokenHash(sha256(raw))
                .tokenType("password_reset")
                .expiresAt(Instant.now().plus(RESET_EXPIRY_HOURS, ChronoUnit.HOURS))
                .build());
            log.info("Password reset created for {}", email);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        InviteToken t = inviteTokens.findByTokenHash(sha256(req.getToken()))
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid reset link"));
        if (t.getIsUsed()) {
            throw ApiException.conflict("token_used", "Reset link already used");
        }
        if (Instant.now().isAfter(t.getExpiresAt())) {
            throw ApiException.gone("token_expired", "Reset link expired");
        }
        if (req.getNewPassword() == null || !req.getNewPassword().equals(req.getConfirmPassword())) {
            throw ApiException.badRequest("password_mismatch", "Passwords do not match");
        }
        validatePw(req.getNewPassword());
        User u = users.findById(t.getUserId())
            .orElseThrow(() -> ApiException.badRequest("invalid_token", "Invalid reset link"));
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
            .userId(u.getUserId())
            .tokenHash(sha256(raw))
            .deviceName(device)
            .ipAddress(ip)
            .isRevoked(false)
            .expiresAt(Instant.now().plus(REFRESH_DAYS, ChronoUnit.DAYS))
            .build());
        return AuthTokens.builder()
            .accessToken(access)
            .refreshToken(raw)
            .accessTokenExpiresIn(1440)
            .tokenType("Bearer")
            .user(AuthTokens.UserSummary.builder()
                .userId(u.getUserId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .role(u.getRole())
                .build())
            .build();
    }

    public static void validatePw(String pw) {
        if (pw == null || pw.length() < 8) {
            throw ApiException.badRequest("weak_password", "Password must be at least 8 characters");
        }
        if (!pw.matches(".*[A-Z].*")) {
            throw ApiException.badRequest("weak_password", "Password must contain an uppercase letter");
        }
        if (!pw.matches(".*[0-9].*")) {
            throw ApiException.badRequest("weak_password", "Password must contain a number");
        }
        if (!pw.matches(".*[^a-zA-Z0-9].*")) {
            throw ApiException.badRequest("weak_password", "Password must contain a special character");
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[96];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
