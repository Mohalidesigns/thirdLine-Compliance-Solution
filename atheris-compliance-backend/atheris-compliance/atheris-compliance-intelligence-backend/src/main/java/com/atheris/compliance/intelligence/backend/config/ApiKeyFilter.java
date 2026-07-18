package com.atheris.compliance.intelligence.backend.config;

import com.atheris.compliance.intelligence.backend.modules.licenses.entity.ApiKey;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.ApiKeyRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class ApiKeyFilter extends OncePerRequestFilter {

    private final ApiKeyRepository apiKeys;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/v1/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        String provided = req.getHeader("X-Api-Key");
        if (provided == null || provided.isBlank()) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Missing X-Api-Key header\"}");
            return;
        }

        String hash = sha256(provided);
        Optional<ApiKey> opt = apiKeys.findByKeyHash(hash);
        if (opt.isEmpty() || !Boolean.TRUE.equals(opt.get().getIsActive())) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Invalid API key\"}");
            return;
        }

        ApiKey key = opt.get();
        key.setLastUsedAt(Instant.now());
        apiKeys.save(key);

        SecurityContextHolder.getContext().setAuthentication(
            new PreAuthenticatedAuthenticationToken("api-key:" + key.getId(), null,
                List.of(new SimpleGrantedAuthority("ROLE_INTERNAL"))));
        chain.doFilter(req, res);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes());
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
