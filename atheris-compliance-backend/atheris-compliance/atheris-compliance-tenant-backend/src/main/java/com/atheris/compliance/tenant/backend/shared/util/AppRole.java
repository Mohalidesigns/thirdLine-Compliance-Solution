package com.atheris.compliance.tenant.backend.shared.util;

/**
 * Canonical role names. These are persisted values (a user's {@code role} column and Spring
 * Security authorities), so the constants must match exactly the strings in the DB and the
 * JWT. Centralised so controllers, services and import handlers can never drift apart.
 *
 * <p>Because {@code @PreAuthorize} takes a SpEL literal, role checks are written by
 * concatenating these compile-time constants, e.g.
 * {@code @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")}.
 */
public final class AppRole {

    private AppRole() {}

    public static final String ANALYST = "ANALYST";
    public static final String CCO = "CCO";
    public static final String TENANT_ADMIN = "TENANT_ADMIN";
    public static final String AUDITOR = "AUDITOR";
}