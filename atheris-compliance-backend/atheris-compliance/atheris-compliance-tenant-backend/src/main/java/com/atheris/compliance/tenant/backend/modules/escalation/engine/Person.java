package com.atheris.compliance.tenant.backend.modules.escalation.engine;

public record Person(String name, String email, Integer userId) {
    public boolean hasEmail() {
        return email != null && !email.isBlank();
    }
}
