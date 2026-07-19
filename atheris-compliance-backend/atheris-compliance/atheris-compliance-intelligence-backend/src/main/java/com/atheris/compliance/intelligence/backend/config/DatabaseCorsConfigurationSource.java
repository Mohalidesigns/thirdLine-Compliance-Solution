package com.atheris.compliance.intelligence.backend.config;

import com.atheris.compliance.intelligence.backend.modules.cors.repository.CorsWhitelistRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

@RequiredArgsConstructor
public class DatabaseCorsConfigurationSource implements CorsConfigurationSource {

    private final CorsWhitelistRepository corsRepo;

    @Override
    public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
        List<String> origins = corsRepo.findByIsActiveTrue().stream()
            .map(c -> c.getOrigin())
            .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        return config;
    }
}
