package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** B3: a step assigned to an application role is worked only by that role (CCO may do Analyst steps). */
class RunbookStepRoleTest {

    @Test
    void appRolesAreEnforced() {
        assertFalse(RunbookExecutionService.roleMayPerform("CCO", "ANALYST"));
        assertFalse(RunbookExecutionService.roleMayPerform("ANALYST", "IT_OPS"));
        assertTrue(RunbookExecutionService.roleMayPerform("ANALYST", "ANALYST"));
        assertTrue(RunbookExecutionService.roleMayPerform("ANALYST", "CCO"));
        assertTrue(RunbookExecutionService.roleMayPerform("it_ops", "IT_OPS"));
    }

    @Test
    void descriptiveRolesAndUnassignedStepsStayOpen() {
        assertTrue(RunbookExecutionService.roleMayPerform("CISO", "IT_OPS"));
        assertTrue(RunbookExecutionService.roleMayPerform("DPO", "ANALYST"));
        assertTrue(RunbookExecutionService.roleMayPerform(null, "ANALYST"));
    }
}
