package com.atheris.compliance.tenant.backend.modules.runbooks.controller;

import com.atheris.compliance.tenant.backend.shared.util.AppRole;

/** @PreAuthorize expressions for the runbook permission matrix (spec §10). */
final class RunbookRoles {

    private RunbookRoles() {}

    static final String ALL = "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN
        + "','" + AppRole.AUDITOR + "','" + AppRole.IT_OPS + "')";
    static final String AUTHORS = "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')";
    static final String APPROVERS = "hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')";
    static final String EXECUTORS = "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN
        + "','" + AppRole.IT_OPS + "')";
    static final String PACK = "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN
        + "','" + AppRole.AUDITOR + "')";
    static final String SIGNERS = "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN
        + "','" + AppRole.AUDITOR + "','" + AppRole.IT_OPS + "')";
}
