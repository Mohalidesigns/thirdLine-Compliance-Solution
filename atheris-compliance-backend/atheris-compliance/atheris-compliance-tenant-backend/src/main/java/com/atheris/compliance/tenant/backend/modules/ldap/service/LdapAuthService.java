package com.atheris.compliance.tenant.backend.modules.ldap.service;

import com.atheris.compliance.tenant.backend.modules.ldap.dto.LdapSettings;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextOperations;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.query.LdapQueryBuilder;
import org.springframework.ldap.support.LdapUtils;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Authenticates a login against the tenant's configured LDAP directory.
 *
 * <p>Flow: bind with the configured service account, search {@code userSearchBase} for the
 * login email (matched on {@code userSearchFilterAttribute}), then re-bind as the found
 * DN with the supplied password to verify it. A user must already have been provisioned in
 * Atheris (by invite) — this service only authenticates, it never creates users.
 *
 * <p>Every failure is turned into a stable outcome rather than an exception escaping to the
 * login path, so a directory outage reads as "authentication unavailable" not a 500.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class LdapAuthService {

    private final TenantIdentityService tenantIdentity;
    private final CryptoUtil crypto;

    /** Outcome of an LDAP authentication attempt. */
    public enum Status { SUCCESS, INVALID_CREDENTIALS, UNAVAILABLE, NOT_CONFIGURED }

    public record LdapResult(Status status, String fullName, String message) {
        public boolean ok() { return status == Status.SUCCESS; }
    }

    /** Whether this tenant authenticates against LDAP and has a usable config. */
    public boolean isLdapEnabled() {
        return currentSettings().isPresent();
    }

    /**
     * The tenant's decrypted LDAP settings, or empty when the tenant uses local auth or has
     * not completed configuration.
     */
    public Optional<LdapSettings> currentSettings() {
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        if (p == null || !"ldap".equalsIgnoreCase(p.getAuthType())) return Optional.empty();
        return settingsFromConfig(p.getLdapConfig());
    }

    /** Parse a stored (password-encrypted) config map into a ready-to-use settings object. */
    public Optional<LdapSettings> settingsFromConfig(Map<String, Object> config) {
        if (config == null) return Optional.empty();
        String url = str(config.get("url"));
        String bindDn = str(config.get("bindDn"));
        String userSearchBase = str(config.get("userSearchBase"));
        if (url == null || bindDn == null || userSearchBase == null) return Optional.empty();
        return Optional.of(LdapSettings.builder()
            .url(url)
            .bindDn(bindDn)
            .bindPassword(decrypt(config.get("bindPassword")))
            .userSearchBase(userSearchBase)
            .userSearchFilterAttribute(orDefault(str(config.get("userSearchFilterAttribute")), "mail"))
            .fullNameAttribute(orDefault(str(config.get("fullNameAttribute")), "cn"))
            .build());
    }

    /** Authenticate a login. Never throws for bad credentials or an unreachable server. */
    public LdapResult authenticate(String email, String password) {
        Optional<LdapSettings> settings = currentSettings();
        if (settings.isEmpty()) return new LdapResult(Status.NOT_CONFIGURED, null, "LDAP is not configured");
        if (password == null || password.isBlank())
            return new LdapResult(Status.INVALID_CREDENTIALS, null, "Invalid credentials");

        LdapSettings s = settings.get();
        LdapContextSource ctx = contextSource(s);
        try {
            String userDn = findUserDn(ctx, s, email);
            if (userDn == null) return new LdapResult(Status.INVALID_CREDENTIALS, null, "Invalid credentials");
            String fullName = findFullName(ctx, s, email);
            // Re-bind as the user to verify the password.
            LdapContextSource userCtx = new LdapContextSource();
            userCtx.setUrl(s.getUrl());
            userCtx.setUserDn(userDn);
            userCtx.setPassword(password);
            userCtx.afterPropertiesSet();
            LdapUtils.closeContext(userCtx.getContext(userDn, password));
            return new LdapResult(Status.SUCCESS, fullName, "ok");
        } catch (org.springframework.ldap.AuthenticationException e) {
            return new LdapResult(Status.INVALID_CREDENTIALS, null, "Invalid credentials");
        } catch (Exception e) {
            // CommunicationException, partial-result, TLS failure, search misconfig, etc.
            log.warn("LDAP authentication unavailable for {}: {}", email, e.getMessage());
            return new LdapResult(Status.UNAVAILABLE, null, "Directory is unavailable — try again shortly");
        }
    }

    /** Verify a candidate config by binding with its service account. Used by the test endpoint. */
    public LdapResult testConnection(LdapSettings s) {
        try {
            LdapContextSource ctx = contextSource(s);
            LdapUtils.closeContext(ctx.getContext(s.getBindDn(), s.getBindPassword()));
            return new LdapResult(Status.SUCCESS, null, "Connection succeeded");
        } catch (org.springframework.ldap.AuthenticationException e) {
            return new LdapResult(Status.INVALID_CREDENTIALS, null, "Service account bind failed — check the DN and password");
        } catch (Exception e) {
            log.warn("LDAP test connection failed: {}", e.getMessage());
            return new LdapResult(Status.UNAVAILABLE, null, "Could not reach the directory: " + e.getMessage());
        }
    }

    // ── helpers ──

    private LdapContextSource contextSource(LdapSettings s) {
        LdapContextSource ctx = new LdapContextSource();
        ctx.setUrl(s.getUrl());
        ctx.setUserDn(s.getBindDn());
        ctx.setPassword(s.getBindPassword());
        ctx.setBase(s.getUserSearchBase());
        ctx.afterPropertiesSet();
        return ctx;
    }

    /** DN of the user whose search attribute equals {@code email}, or null if not found. */
    private String findUserDn(LdapContextSource ctx, LdapSettings s, String email) {
        LdapTemplate template = new LdapTemplate(ctx);
        var results = template.search(
            LdapQueryBuilder.query().base(s.getUserSearchBase())
                .where(s.getUserSearchFilterAttribute()).is(email),
            (ContextMapper<String>) c -> ((DirContextOperations) c).getNameInNamespace());
        return results.isEmpty() ? null : results.get(0);
    }

    private String findFullName(LdapContextSource ctx, LdapSettings s, String email) {
        try {
            LdapTemplate template = new LdapTemplate(ctx);
            var results = template.search(
                LdapQueryBuilder.query().base(s.getUserSearchBase())
                    .where(s.getUserSearchFilterAttribute()).is(email),
                (ContextMapper<String>) c -> ((DirContextOperations) c).getStringAttribute(s.getFullNameAttribute()));
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    private static String orDefault(String v, String def) { return v != null ? v : def; }

    /** Stored bind password is encrypted; accept a plaintext legacy value gracefully. */
    private String decrypt(Object stored) {
        String v = str(stored);
        if (v == null) return null;
        try {
            return crypto.decrypt(v);
        } catch (Exception e) {
            return v;
        }
    }
}