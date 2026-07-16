package com.atheris.tenant.modules.users.service;

import com.atheris.tenant.modules.auth.entity.InviteToken;
import com.atheris.tenant.modules.auth.repository.*;
import com.atheris.tenant.modules.users.dto.*;
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
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository users;
    private final InviteTokenRepository inviteTokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;

    public List<UserDto> findAll() {
        return users.findByIsActiveTrue().stream().map(this::toDto).toList();
    }

    public UserDto findById(Integer id) {
        return toDto(users.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found")));
    }

    @Transactional
    public UserDto invite(InviteUserRequest req, Integer invitedBy) {
        if (users.existsByEmail(req.getEmail().toLowerCase()))
            throw new RuntimeException("Email already exists");
        User user = User.builder()
            .email(req.getEmail().toLowerCase().trim()).fullName(req.getFullName())
            .jobTitle(req.getJobTitle()).department(req.getDepartment()).role(req.getRole())
            .inviteStatus("pending").invitedByUserId(invitedBy).invitedAt(Instant.now())
            .isActive(true).build();
        users.save(user);
        String raw = generateToken();
        inviteTokens.save(InviteToken.builder()
            .userId(user.getUserId()).token(raw).tokenHash(sha256(raw))
            .tokenType("invite")
            .expiresAt(Instant.now().plus(72, ChronoUnit.HOURS))
            .createdByUserId(invitedBy).build());
        log.info("Invite sent to {} (role: {})", user.getEmail(), user.getRole());
        return toDto(user);
    }

    @Transactional
    public void changePassword(Integer userId, ChangePasswordRequest req) {
        User user = users.findById(userId).orElseThrow();
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash()))
            throw new RuntimeException("Current password incorrect");
        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw new RuntimeException("Passwords do not match");
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        user.setPasswordChangedAt(Instant.now());
        users.save(user);
        refreshTokens.findByUserIdAndIsRevokedFalse(userId).forEach(rt -> {
            rt.setIsRevoked(true);
            rt.setRevokedAt(Instant.now());
            rt.setRevokedReason("password_change");
            refreshTokens.save(rt);
        });
    }

    @Transactional
    public void deactivate(Integer userId) {
        User user = users.findById(userId).orElseThrow();
        user.setIsActive(false);
        users.save(user);
        refreshTokens.findByUserIdAndIsRevokedFalse(userId).forEach(rt -> {
            rt.setIsRevoked(true);
            rt.setRevokedAt(Instant.now());
            rt.setRevokedReason("admin_deactivate");
            refreshTokens.save(rt);
        });
    }

    @Transactional
    public UserDto reactivate(Integer id) {
        User u = users.findById(id).orElseThrow();
        u.setIsActive(true);
        return toDto(users.save(u));
    }

    @Transactional
    public UserDto updateRole(Integer id, String role) {
        User u = users.findById(id).orElseThrow();
        u.setRole(role);
        return toDto(users.save(u));
    }

    private UserDto toDto(User u) {
        return UserDto.builder()
            .userId(u.getUserId()).email(u.getEmail()).fullName(u.getFullName())
            .jobTitle(u.getJobTitle()).department(u.getDepartment()).role(u.getRole())
            .isActive(u.getIsActive()).inviteStatus(u.getInviteStatus())
            .lastLoginAt(u.getLastLoginAt()).invitedAt(u.getInvitedAt()).build();
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
