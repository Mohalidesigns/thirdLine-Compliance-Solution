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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class LdapAuthService {

    private final TenantIdentityService tenantIdentity;
    private final CryptoUtil crypto;

    public enum Status { SUCCESS, INVALID_CREDENTIALS, UNAVAILABLE, NOT_CONFIGURED }

    public record LdapResult(Status status, String fullName, String message) {
        public boolean ok() {
            return status == Status.SUCCESS;
        }
    }

    /** A directory entry offered to the person picker: the login email plus a display name. */
    public record DirectoryUser(String email, String fullName, String dn) {
    }

    public boolean isLdapEnabled() {
        return currentSettings().isPresent();
    }

    public Optional<LdapSettings> currentSettings() {
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        if (p == null || !"ldap".equalsIgnoreCase(p.getAuthType())) {
            return Optional.empty();
        }
        return settingsFromConfig(p.getLdapConfig());
    }

    public Optional<LdapSettings> settingsFromConfig(Map<String, Object> config) {
        if (config == null) {
            return Optional.empty();
        }
        String url = str(config.get("url"));
        String bindDn = str(config.get("bindDn"));
        String userSearchBase = str(config.get("userSearchBase"));
        if (url == null || bindDn == null || userSearchBase == null) {
            return Optional.empty();
        }
        return Optional.of(LdapSettings.builder()
            .url(url)
            .bindDn(bindDn)
            .bindPassword(decrypt(config.get("bindPassword")))
            .userSearchBase(userSearchBase)
            .userSearchFilterAttribute(orDefault(str(config.get("userSearchFilterAttribute")), "mail"))
            .fullNameAttribute(orDefault(str(config.get("fullNameAttribute")), "cn"))
            .build());
    }

    public LdapResult authenticate(String email, String password) {
        Optional<LdapSettings> settings = currentSettings();
        if (settings.isEmpty()) {
            return new LdapResult(Status.NOT_CONFIGURED, null, "LDAP is not configured");
        }
        if (password == null || password.isBlank()) {
            return new LdapResult(Status.INVALID_CREDENTIALS, null, "Invalid credentials");
        }

        LdapSettings s = settings.get();
        LdapContextSource ctx = contextSource(s);
        try {
            String userDn = findUserDn(ctx, s, email);
            if (userDn == null) {
                return new LdapResult(Status.INVALID_CREDENTIALS, null, "Invalid credentials");
            }
            String fullName = findFullName(ctx, s, email);
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
            log.warn("LDAP authentication unavailable for {}: {}", email, e.getMessage());
            return new LdapResult(Status.UNAVAILABLE, null, "Directory is unavailable — try again shortly");
        }
    }

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

    /**
     * Search the directory using the tenant's saved settings. Empty when LDAP is not configured.
     */
    public List<DirectoryUser> searchUsers(String q) {
        return currentSettings().map(s -> searchUsers(s, q)).orElseGet(List::of);
    }

    /**
     * Search the directory for users matching {@code q} on the login (email) attribute or the
     * full-name attribute. A blank {@code q} returns the first page of the directory. Never throws —
     * an unreachable directory yields an empty list. Takes explicit settings so onboarding can
     * search a directory that has not been persisted yet.
     */
    public List<DirectoryUser> searchUsers(LdapSettings s, String q) {
        if (s == null || s.getUrl() == null || s.getUserSearchBase() == null) {
            return List.of();
        }
        String term = q == null ? "" : sanitize(q);
        LdapTemplate template = new LdapTemplate(contextSource(s));
        Map<String, DirectoryUser> merged = new LinkedHashMap<>();
        try {
            searchInto(template, s, s.getUserSearchFilterAttribute(), term, merged);
            if (!s.getFullNameAttribute().equalsIgnoreCase(s.getUserSearchFilterAttribute())) {
                searchInto(template, s, s.getFullNameAttribute(), term, merged);
            }
        } catch (Exception e) {
            log.warn("LDAP directory search failed: {}", e.getMessage());
            return List.of();
        }
        return new ArrayList<>(merged.values());
    }

    /** Search one attribute and merge hits (keyed by DN) so the two passes don't duplicate. */
    private void searchInto(LdapTemplate template, LdapSettings s, String attribute, String term,
            Map<String, DirectoryUser> out) {
        String pattern = term.isEmpty() ? "*" : "*" + term + "*";
        List<DirectoryUser> results = template.search(
            LdapQueryBuilder.query().base(s.getUserSearchBase())
                .where(attribute).like(pattern),
            (ContextMapper<DirectoryUser>) c -> {
                DirContextOperations d = (DirContextOperations) c;
                return new DirectoryUser(
                    d.getStringAttribute(s.getUserSearchFilterAttribute()),
                    d.getStringAttribute(s.getFullNameAttribute()),
                    d.getNameInNamespace());
            });
        for (DirectoryUser u : results) {
            if (u.dn() != null && u.email() != null && !u.email().isBlank()) {
                out.putIfAbsent(u.dn().toLowerCase(), u);
            }
        }
    }

    /** Strip LDAP filter metacharacters so a free-text term can't break the search filter. */
    private static String sanitize(String q) {
        return q.trim().replaceAll("[^A-Za-z0-9@._\\- ]", "");
    }

    private LdapContextSource contextSource(LdapSettings s) {
        LdapContextSource ctx = new LdapContextSource();
        ctx.setUrl(s.getUrl());
        ctx.setUserDn(s.getBindDn());
        ctx.setPassword(s.getBindPassword());
        // Do not set a context base here: the search query supplies its own base, and
        // setting both makes spring-ldap concatenate them into a non-existent DN.
        ctx.afterPropertiesSet();
        return ctx;
    }

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
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    private static String orDefault(String v, String def) {
        return v != null ? v : def;
    }

    private String decrypt(Object stored) {
        String v = str(stored);
        if (v == null) {
            return null;
        }
        try {
            return crypto.decrypt(v);
        } catch (Exception e) {
            return v;
        }
    }
}