package com.atheris.compliance.tenant.backend.modules.tasks.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskCenterWindowTest {

    @Test
    void usesTheControlsOwnCadenceWhenNoOverride() {
        Control monthly = control("Monthly");
        assertTrue(TaskCenterService.withinControlHorizon(30, monthly, null));
        assertTrue(TaskCenterService.withinControlHorizon(10, monthly, null));
        assertFalse(TaskCenterService.withinControlHorizon(31, monthly, null));
    }

    @Test
    void longerCadencesAreVisibleWithinTheirOwnWindow() {
        Control annual = control("Annual");
        assertTrue(TaskCenterService.withinControlHorizon(300, annual, null));
        assertFalse(TaskCenterService.withinControlHorizon(366, annual, null));
    }

    @Test
    void derivesCadenceFromTheFrequency() {
        Control derived = control("Quarterly");
        assertTrue(TaskCenterService.withinControlHorizon(90, derived, null));
        assertFalse(TaskCenterService.withinControlHorizon(91, derived, null));
    }

    @Test
    void explicitOverrideWinsWhenPositive() {
        Control annual = control("Annual");
        assertFalse(TaskCenterService.withinControlHorizon(60, annual, 30));
        assertTrue(TaskCenterService.withinControlHorizon(30, annual, 30));
    }

    @Test
    void zeroOverrideFallsBackToCadence() {
        Control monthly = control("Monthly");
        assertTrue(TaskCenterService.withinControlHorizon(30, monthly, 0));
    }

    @Test
    void unknownCadenceUsesTheThirtyDayFallback() {
        Control unknown = control("Ad hoc");
        assertTrue(TaskCenterService.withinControlHorizon(30, unknown, null));
        assertFalse(TaskCenterService.withinControlHorizon(31, unknown, null));
    }

    private static Control control(String frequency) {
        return Control.builder().testFrequency(frequency).build();
    }
}
