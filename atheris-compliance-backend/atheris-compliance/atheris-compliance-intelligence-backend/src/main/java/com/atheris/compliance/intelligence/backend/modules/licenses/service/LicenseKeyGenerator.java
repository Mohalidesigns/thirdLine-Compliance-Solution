package com.atheris.compliance.intelligence.backend.modules.licenses.service;

import org.springframework.stereotype.Component;
import java.security.SecureRandom;

@Component
public class LicenseKeyGenerator {

    private static final String HEX = "0123456789ABCDEF";
    private static final int GROUPS = 4;
    private static final int GROUP_SIZE = 4;
    private static final SecureRandom RANDOM = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder("ATH-");
        for (int g = 0; g < GROUPS; g++) {
            if (g > 0) sb.append('-');
            for (int i = 0; i < GROUP_SIZE; i++) {
                sb.append(HEX.charAt(RANDOM.nextInt(HEX.length())));
            }
        }
        return sb.toString();
    }
}
