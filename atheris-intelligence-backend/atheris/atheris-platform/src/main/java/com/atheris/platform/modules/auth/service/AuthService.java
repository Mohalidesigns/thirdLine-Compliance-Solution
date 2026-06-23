package com.atheris.platform.modules.auth.service;

import com.atheris.common.Constants;
import com.atheris.platform.modules.auth.dto.*;
import com.atheris.platform.modules.auth.entity.User;
import com.atheris.platform.modules.auth.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service @Slf4j @RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.jwt.secret}")
    private String jwtSecret;

    @Value("${atheris.jwt.expiry-minutes:15}")
    private int expiryMinutes;

    public LoginResponse authenticate(String email, String password) {
        User user = userRepo.findByEmail(email.toLowerCase().trim())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new RuntimeException("Account is deactivated");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = Jwts.builder()
            .subject(user.getUserId().toString())
            .claim(Constants.JWT_CLAIM_ROLE, user.getRole())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiryMinutes * 60_000L))
            .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
            .compact();

        log.info("User {} ({}) logged in", user.getEmail(), user.getUserId());

        return LoginResponse.builder()
            .accessToken(token)
            .user(toDto(user))
            .build();
    }

    public UserDto getCurrentUser(Authentication auth) {
        Long userId = Long.valueOf(auth.getName());
        User user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return toDto(user);
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
