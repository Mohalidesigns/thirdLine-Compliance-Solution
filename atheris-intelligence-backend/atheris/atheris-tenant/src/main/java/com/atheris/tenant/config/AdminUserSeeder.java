package com.atheris.tenant.config;

import com.atheris.tenant.modules.users.entity.User;
import com.atheris.tenant.modules.users.repository.UserRepository;
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
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("ADMIN_PASSWORD not configured — skipping admin seed");
            return;
        }

        if (userRepo.findByEmail(adminEmail).isPresent()) {
            log.info("Admin user {} already exists", adminEmail);
            return;
        }

        User admin = User.builder()
            .email(adminEmail)
            .fullName("Tenant Admin")
            .passwordHash(passwordEncoder.encode(adminPassword))
            .role("TENANT_ADMIN")
            .inviteStatus("active")
            .isActive(true)
            .emailVerified(true)
            .failedLoginAttempts(0)
            .build();

        userRepo.save(admin);
        log.info("Seeded tenant admin user: {}", adminEmail);
    }
}
