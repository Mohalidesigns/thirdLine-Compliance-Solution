package com.atheris.tenant.modules.license.filter;

import com.atheris.tenant.modules.license.exception.LicenseBlockedException;
import com.atheris.tenant.modules.license.service.LicenseService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class LicenseFilter extends OncePerRequestFilter {

    private final LicenseService licenseService;

    private static final Set<String> EXCLUDED_PATHS = Set.of(
        "/api/v1/auth/",
        "/api/v1/license/activate",
        "/api/v1/license/status",
        "/actuator/health"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        boolean excluded = EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
        if (excluded) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            licenseService.requireActiveLicense();
            filterChain.doFilter(request, response);
        } catch (LicenseBlockedException e) {
            String msg = e.getMessage();
            if (msg.contains("No license")) {
                response.setStatus(402);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"payment_required\",\"message\":\"" + msg + "\"}");
            } else {
                response.setStatus(403);
                response.setHeader("X-License-Status", "expired");
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"license_blocked\",\"message\":\"" + msg + "\"}");
            }
        }
    }
}
