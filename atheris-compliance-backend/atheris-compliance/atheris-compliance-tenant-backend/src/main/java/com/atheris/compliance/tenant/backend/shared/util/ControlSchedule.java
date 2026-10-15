package com.atheris.compliance.tenant.backend.shared.util;

/**
 * Control-test cadence helper. The platform seed carries a human-readable frequency
 * ("Monthly", "Quarterly", ...); the tenant turns it into a number of days so it can
 * compute the next test due date from the system date and schedule the test task.
 * When a control arrives with no frequency, a risk-tiered default is used.
 */
public final class ControlSchedule {

    private ControlSchedule() {
    }

    /** Returns the number of days for a frequency label, or null when unrecognised. */
    public static Integer daysForFrequency(String frequency) {
        if (frequency == null || frequency.isBlank()) {
            return null;
        }
        String f = frequency.trim().toLowerCase();
        if (f.contains("day")) {
            return 1;
        }
        if (f.contains("week")) {
            return 7;
        }
        if (f.contains("month")) {
            return 30;
        }
        if (f.contains("quarter")) {
            return 90;
        }
        if (f.contains("semi") || f.contains("half") || f.contains("biannual")) {
            return 182;
        }
        if (f.contains("bienn") || f.contains("two year") || f.contains("2 year")) {
            return 730;
        }
        if (f.contains("annual") || f.contains("year")) {
            return 365;
        }
        return null;
    }

    /** Risk-tiered default cadence, applied when a control has no frequency of its own. */
    public static String frequencyForRisk(String riskLevel) {
        if (riskLevel == null || riskLevel.isBlank()) {
            return "Annual";
        }
        return switch (riskLevel.trim()) {
            case "Critical" -> "Monthly";
            case "High" -> "Quarterly";
            case "Moderate", "Medium" -> "Semi-Annual";
            case "Low" -> "Annual";
            default -> "Annual";
        };
    }
}
