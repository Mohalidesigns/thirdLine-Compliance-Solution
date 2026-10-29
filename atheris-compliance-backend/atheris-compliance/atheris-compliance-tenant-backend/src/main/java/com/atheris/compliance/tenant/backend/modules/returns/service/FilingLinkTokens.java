package com.atheris.compliance.tenant.backend.modules.returns.service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class FilingLinkTokens {

    private FilingLinkTokens() {
    }

    public static String token(String secret, Long instanceId) {
        if (secret == null || secret.isBlank() || instanceId == null) {
            throw new IllegalArgumentException("A signing secret and a filing id are required");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(("filing:" + instanceId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Could not derive the filing link token", e);
        }
    }
}
