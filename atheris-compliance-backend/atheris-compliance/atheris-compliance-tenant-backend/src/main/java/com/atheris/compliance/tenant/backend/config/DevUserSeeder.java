package com.atheris.compliance.tenant.backend.config;

import com.atheris.compliance.tenant.backend.modules.auth.service.AuthService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Dev only — never enable in production. Seeds one fully-activated local user per
 * tenant role so each role can be exercised without the invite flow. Idempotent:
 * an existing user is left untouched (its password is never reset).
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class DevUserSeeder implements CommandLineRunner {

    private record SeedUser(String localPart, String role, String fullName) {}

    private static final List<SeedUser> SEED_USERS = List.of(
        new SeedUser("admin", AppRole.TENANT_ADMIN, "Dev Tenant Admin"),
        new SeedUser("cco", AppRole.CCO, "Dev CCO"),
        new SeedUser("analyst", AppRole.ANALYST, "Dev Analyst"),
        new SeedUser("auditor", AppRole.AUDITOR, "Dev Auditor"),
        new SeedUser("itops", AppRole.IT_OPS, "Dev IT Operations"));

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.seed.users.enabled:false}")
    private boolean enabled;

    @Value("${atheris.seed.users.domain:mamcorp.test}")
    private String domain;

    @Value("${atheris.seed.users.password:}")
    private String password;

    /**
     * Optional real inboxes per seed user, e.g. {@code cco=me@gmail.com,analyst=you@gmail.com}
     * (keys are the local parts above). An existing user under the default address is renamed
     * in place, so its id, password and history are kept.
     */
    @Value("${atheris.seed.users.emails:}")
    private String emailOverrides;

    @Override
    public void run(String... args) {
        if (!enabled) {
            log.debug("Dev user seeding disabled (SEED_USERS_ENABLED=false)");
            return;
        }
        if (password == null || password.isBlank()) {
            log.warn("SEED_USERS_ENABLED=true but SEED_USERS_PASSWORD is blank — skipping dev user seed");
            return;
        }
        try {
            AuthService.validatePw(password);
        } catch (ApiException e) {
            log.warn("SEED_USERS_PASSWORD rejected ({}) — skipping dev user seed", e.getMessage());
            return;
        }

        String hash = passwordEncoder.encode(password);
        String d = domain.trim().toLowerCase();
        Map<String, String> overrides = parseOverrides(emailOverrides);
        for (SeedUser s : SEED_USERS) {
            String defaultEmail = s.localPart() + "@" + d;
            String email = overrides.getOrDefault(s.localPart(), defaultEmail);
            if (users.existsByEmail(email)) {
                log.info("Dev user {} already exists", email);
                continue;
            }
            Optional<User> legacy = email.equals(defaultEmail) ? Optional.empty() : users.findByEmail(defaultEmail);
            if (legacy.isPresent()) {
                User u = legacy.get();
                u.setEmail(email);
                users.save(u);
                log.info("Dev user {} renamed to {} ({})", defaultEmail, email, s.role());
                continue;
            }
            users.save(User.builder()
                .email(email)
                .fullName(s.fullName())
                .role(s.role())
                .passwordHash(hash)
                .isActive(true)
                .emailVerified(true)
                .inviteStatus("active")
                .passwordChangedAt(Instant.now())
                .build());
            log.info("Seeded dev user {} ({})", email, s.role());
        }
    }

    private static Map<String, String> parseOverrides(String raw) {
        Map<String, String> out = new HashMap<>();
        if (raw == null || raw.isBlank()) return out;
        for (String pair : raw.split(",")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && !kv[0].isBlank() && kv[1].contains("@")) {
                out.put(kv[0].trim().toLowerCase(), kv[1].trim().toLowerCase());
            }
        }
        return out;
    }
}
