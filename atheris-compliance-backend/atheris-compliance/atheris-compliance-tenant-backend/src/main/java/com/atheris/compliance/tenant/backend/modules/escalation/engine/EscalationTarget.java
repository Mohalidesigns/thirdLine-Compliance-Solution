package com.atheris.compliance.tenant.backend.modules.escalation.engine;

public record EscalationTarget(String name, String email, Integer userId, String role) {
}
