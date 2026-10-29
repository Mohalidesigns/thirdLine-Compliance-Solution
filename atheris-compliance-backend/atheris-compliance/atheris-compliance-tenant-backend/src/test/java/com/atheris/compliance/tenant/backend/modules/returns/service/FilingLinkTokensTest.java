package com.atheris.compliance.tenant.backend.modules.returns.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FilingLinkTokensTest {

    @Test
    void sameFilingAlwaysYieldsTheSameToken() {
        String first = FilingLinkTokens.token("secret-a", 42L);
        String second = FilingLinkTokens.token("secret-a", 42L);
        assertTrue(first.equals(second));
    }

    @Test
    void differentFilingsAndSecretsYieldDifferentTokens() {
        assertNotEquals(FilingLinkTokens.token("secret-a", 42L), FilingLinkTokens.token("secret-a", 43L));
        assertNotEquals(FilingLinkTokens.token("secret-a", 42L), FilingLinkTokens.token("secret-b", 42L));
    }

    @Test
    void tokenIsUrlSafeBase64() {
        String token = FilingLinkTokens.token("secret-a", 1L);
        assertTrue(token.matches("[A-Za-z0-9_-]+"));
    }

    @Test
    void missingSecretOrIdIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> FilingLinkTokens.token(null, 1L));
        assertThrows(IllegalArgumentException.class, () -> FilingLinkTokens.token("  ", 1L));
        assertThrows(IllegalArgumentException.class, () -> FilingLinkTokens.token("secret-a", null));
    }
}
