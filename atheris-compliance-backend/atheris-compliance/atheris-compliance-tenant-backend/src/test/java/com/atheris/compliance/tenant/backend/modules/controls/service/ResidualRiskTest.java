package com.atheris.compliance.tenant.backend.modules.controls.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResidualRiskTest {

    @Test
    void passedLowersToLow() {
        assertEquals("Low", ResidualRisk.fromTestResult("Passed", "High"));
        assertEquals("Low", ResidualRisk.fromTestResult("Passed", "Low"));
    }

    @Test
    void partialSetsMedium() {
        assertEquals("Medium", ResidualRisk.fromTestResult("Partial", "High"));
        assertEquals("Medium", ResidualRisk.fromTestResult("Partial", "Moderate"));
    }

    @Test
    void failedRestoresInherent() {
        assertEquals("High", ResidualRisk.fromTestResult("Failed", "High"));
        assertEquals("Moderate", ResidualRisk.fromTestResult("Failed", "Moderate"));
        assertEquals("Critical", ResidualRisk.fromTestResult("Failed", "Critical"));
    }

    @Test
    void residualNeverExceedsInherent() {
        assertEquals("Low", ResidualRisk.fromTestResult("Partial", "Low"));
        assertEquals("Low", ResidualRisk.capAtInherent("Medium", "Low"));
        assertEquals("Moderate", ResidualRisk.capAtInherent("High", "Moderate"));
    }
}
