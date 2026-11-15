package com.atheris.compliance.tenant.backend.modules.risks.service;

public record ResidualRule(int allDrop, int majorityDrop, Axis axis, String target, int floor) {

    public enum Axis { LIKELIHOOD, IMPACT, BOTH }

    public static ResidualRule defaults() {
        return new ResidualRule(2, 1, Axis.LIKELIHOOD, "Passed", 1);
    }

    public static Axis parseAxis(String value) {
        if (value == null) return Axis.LIKELIHOOD;
        try {
            return Axis.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Axis.LIKELIHOOD;
        }
    }

    public boolean targetsLikelihood() { return axis == Axis.LIKELIHOOD || axis == Axis.BOTH; }
    public boolean targetsImpact() { return axis == Axis.IMPACT || axis == Axis.BOTH; }

    public boolean lenientTarget() {
        return target != null && target.trim().equalsIgnoreCase("PassedOrPartial");
    }
}