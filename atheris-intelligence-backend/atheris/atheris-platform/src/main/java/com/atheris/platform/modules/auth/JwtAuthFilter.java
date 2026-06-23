package com.atheris.platform.modules.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.atheris.common.Constants;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component @Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    @Value("${atheris.jwt.secret}")
    private String jwtSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader(Constants.HEADER_AUTHORIZATION);
        if (header == null || !header.startsWith(Constants.BEARER_PREFIX)) {
            chain.doFilter(req, res); return;
        }
        String token = header.substring(7);

        // demo-jwt-token is client-side only (frontend returns mock data, never hits backend)
        if ("demo-jwt-token".equals(token)) {
            chain.doFilter(req, res); return;
        }

        try {
            Claims claims = Jwts.parser()
                .setSigningKey(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .build().parseClaimsJws(token).getBody();

            String userId = claims.getSubject();
            String role = claims.get(Constants.JWT_CLAIM_ROLE, String.class);

            var auth = new UsernamePasswordAuthenticationToken(userId, null,
                List.of(new SimpleGrantedAuthority(Constants.ROLE_PREFIX + role)));
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (ExpiredJwtException e) {
            log.debug("JWT expired");
        } catch (JwtException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
        }
        chain.doFilter(req, res);
    }


}
