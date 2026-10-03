package com.atheris.compliance.tenant.backend.config;

import com.atheris.compliance.tenant.backend.modules.auth.filter.JwtAuthFilter;
import com.atheris.compliance.tenant.backend.modules.cors.repository.CorsWhitelistRepository;
import com.atheris.compliance.tenant.backend.modules.license.filter.LicenseFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final LicenseFilter licenseFilter;
    private final CorsWhitelistRepository corsRepo;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/auth/**",
                    "/api/v1/onboarding/**",
                    "/api/v1/recommendations/**",
                    "/api/v1/license/**",
                    "/actuator/health"
                ).permitAll()
                .anyRequest().authenticated())
            // Without these, Spring Security's default entry point answers a missing/expired/invalid
            // JWT with 403, which the frontend cannot tell apart from a genuine role denial.
            // JwtAuthFilter swallows token errors and leaves the request anonymous, so an expired
            // token reaches the entry point -> 401; an authenticated user lacking a role -> 403.
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint((req, res, ex) ->
                    writeJson(res, HttpServletResponse.SC_UNAUTHORIZED, UNAUTHORIZED_BODY))
                .accessDeniedHandler((req, res, ex) ->
                    writeJson(res, HttpServletResponse.SC_FORBIDDEN, FORBIDDEN_BODY)))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(licenseFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private static final String UNAUTHORIZED_BODY =
        "{\"error\":\"unauthorized\",\"message\":\"Authentication required\"}";
    private static final String FORBIDDEN_BODY =
        "{\"error\":\"forbidden\",\"message\":\"You do not have permission to perform this action.\"}";

    private static void writeJson(HttpServletResponse res, int status, String body) throws IOException {
        if (res.isCommitted()) return;
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write(body);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService noopUserDetailsService() {
        return username -> { throw new RuntimeException("JWT-only auth"); };
    }

    @Bean
    public DatabaseCorsConfigurationSource corsConfigurationSource() {
        return new DatabaseCorsConfigurationSource(corsRepo);
    }
}
