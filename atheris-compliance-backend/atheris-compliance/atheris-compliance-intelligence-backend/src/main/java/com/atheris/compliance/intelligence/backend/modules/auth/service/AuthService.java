package com.atheris.compliance.intelligence.backend.modules.auth.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.auth.dto.*;
import com.atheris.compliance.intelligence.backend.modules.auth.entity.RefreshToken;
import com.atheris.compliance.intelligence.backend.modules.auth.entity.User;
import com.atheris.compliance.intelligence.backend.modules.auth.repository.RefreshTokenRepository;
import com.atheris.compliance.intelligence.backend.modules.auth.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service @Slf4j @RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final RefreshTokenRepository refreshTokenRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.jwt.secret}")
    private String jwtSecret;

    @Value("${atheris.jwt.expiry-minutes:15}")
    private int expiryMinutes;

    @Value("${atheris.jwt.refresh-token-expiry-days:30}")
    private int refreshTokenExpiryDays;

    @Transactional
    public LoginResponse authenticate(String email, String password) {
        User user = userRepo.findByEmail(email.toLowerCase().trim())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new RuntimeException("Account is deactivated");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String accessToken = buildAccessToken(user);
        String refreshToken = createRefreshToken(user.getUserId());

        log.info("User {} ({}) logged in", user.getEmail(), user.getUserId());

        return LoginResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .user(toDto(user))
            .build();
    }

    @Transactional
    public LoginResponse refreshAccessToken(String refreshTokenValue) {
        RefreshToken rt = refreshTokenRepo.findByToken(refreshTokenValue)
            .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (rt.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepo.delete(rt);
            throw new RuntimeException("Refresh token expired");
        }

        User user = userRepo.findById(rt.getUserId())
            .orElseThrow(() -> new RuntimeException("User not found"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            refreshTokenRepo.delete(rt);
            throw new RuntimeException("Account is deactivated");
        }

        refreshTokenRepo.delete(rt);

        String newAccessToken = buildAccessToken(user);
        String newRefreshToken = createRefreshToken(user.getUserId());

        log.info("Token refreshed for user {} ({})", user.getEmail(), user.getUserId());

        return LoginResponse.builder()
            .accessToken(newAccessToken)
            .refreshToken(newRefreshToken)
            .user(toDto(user))
            .build();
    }

    public UserDto getCurrentUser(Authentication auth) {
        Long userId = Long.valueOf(auth.getName());
        User user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return toDto(user);
    }

    private String buildAccessToken(User user) {
        return Jwts.builder()
            .subject(user.getUserId().toString())
            .claim(Constants.JWT_CLAIM_ROLE, user.getRole())
            .claim("tenantId", user.getTenantId())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiryMinutes * 60_000L))
            .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }

    private String createRefreshToken(Long userId) {
        refreshTokenRepo.deleteByUserId(userId);

        String token = UUID.randomUUID().toString();
        RefreshToken rt = RefreshToken.builder()
            .token(token)
            .userId(userId)
            .expiresAt(Instant.now().plusSeconds(refreshTokenExpiryDays * 86400L))
            .build();
        refreshTokenRepo.save(rt);
        return token;
    }

    private UserDto toDto(User user) {
        return UserDto.builder()
            .id(user.getUserId())
            .email(user.getEmail())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .role(user.getRole())
            .build();
    }
}
