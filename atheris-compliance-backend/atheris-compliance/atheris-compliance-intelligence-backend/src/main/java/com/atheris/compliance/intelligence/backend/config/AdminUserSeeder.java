package com.atheris.compliance.intelligence.backend.config;

import com.atheris.compliance.intelligence.backend.modules.auth.entity.User;
import com.atheris.compliance.intelligence.backend.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component @Slf4j @RequiredArgsConstructor
public class AdminUserSeeder implements CommandLineRunner {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.admin.username}")
    private String adminEmail;

    @Value("${atheris.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        if (adminEmail == null || adminEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            log.warn("ADMIN_USERNAME or ADMIN_PASSWORD not configured — skipping admin seed");
            return;
        }

        if (userRepo.findByEmail(adminEmail).isPresent()) {
            log.info("Admin user {} already exists", adminEmail);
            return;
        }

        User admin = User.builder()
            .email(adminEmail)
            .passwordHash(passwordEncoder.encode(adminPassword))
            .firstName("Platform")
            .lastName("Admin")
            .role("PLATFORM_ADMIN")
            .isActive(true)
            .build();

        userRepo.save(admin);
        log.info("Seeded admin user: {}", adminEmail);
    }
}
