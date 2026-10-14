package com.atheris.compliance.tenant.backend.modules.ldap.service;

import com.atheris.compliance.tenant.backend.modules.ldap.dto.LdapSettings;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Parsing/decryption of the persisted LDAP config. Pure logic — no directory required.
 * The service is constructed with null collaborators because these methods do not touch them.
 */
class LdapAuthServiceTest {

    private final CryptoUtil crypto = new CryptoUtil("test-encryption-key");
    private final LdapAuthService service = new LdapAuthService(null, crypto);

    private Map<String, Object> storedConfig(String encryptedBind) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", "ldap://localhost:1389");
        m.put("bindDn", "cn=admin,dc=atheris,dc=test");
        m.put("bindPassword", encryptedBind);
        m.put("userSearchBase", "ou=people,dc=atheris,dc=test");
        return m;
    }

    @Test
    void decryptsBindPasswordAndAppliesDefaults() {
        String enc = crypto.encrypt("adminpassword");
        Optional<LdapSettings> s = service.settingsFromConfig(storedConfig(enc));
        assertTrue(s.isPresent());
        assertEquals("adminpassword", s.get().getBindPassword());
        assertEquals("mail", s.get().getUserSearchFilterAttribute());
        assertEquals("cn", s.get().getFullNameAttribute());
    }

    @Test
    void honoursExplicitSearchAndNameAttributes() {
        Map<String, Object> cfg = storedConfig(crypto.encrypt("pw"));
        cfg.put("userSearchFilterAttribute", "uid");
        cfg.put("fullNameAttribute", "displayName");
        LdapSettings s = service.settingsFromConfig(cfg).orElseThrow();
        assertEquals("uid", s.getUserSearchFilterAttribute());
        assertEquals("displayName", s.getFullNameAttribute());
    }

    @Test
    void emptyWhenRequiredFieldsMissing() {
        Map<String, Object> cfg = storedConfig(crypto.encrypt("pw"));
        cfg.remove("userSearchBase");
        assertTrue(service.settingsFromConfig(cfg).isEmpty());
        assertTrue(service.settingsFromConfig(null).isEmpty());
    }

    @Test
    void toleratesPlaintextLegacyPassword() {
        // A value that is not valid ciphertext is returned as-is rather than failing.
        Optional<LdapSettings> s = service.settingsFromConfig(storedConfig("not-encrypted-plain"));
        assertTrue(s.isPresent());
        assertEquals("not-encrypted-plain", s.get().getBindPassword());
    }
}