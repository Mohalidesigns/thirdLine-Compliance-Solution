package com.atheris.compliance.common.risk;

import java.util.Locale;
import java.util.Map;

/**
 * One risk-band rule for both backends: likelihood × impact on a 1..5 scale, banded
 * Low (&lt;6) / Moderate (6..11) / High (12..17) / Critical (≥18) — the same cut-offs as the
 * tenant risk matrix ({@code risk_matrix_config}, V28).
 *
 * <p>Accepts both label scales in use: the toolkit's Very Low..Very High and the canonical
 * matrix axes (impact Insignificant..Severe, likelihood Rare..Almost Certain).
 */
public final class RiskBands {

    public static final String CRITICAL = "Critical";
    public static final String HIGH = "High";
    public static final String MODERATE = "Moderate";
    public static final String LOW = "Low";
    /** Bucket for obligations/instruments with no rating — never defaulted to a real band. */
    public static final String UNRATED = "Unrated";

    private static final Map<String, Integer> LEVELS = Map.ofEntries(
        // toolkit scale
        Map.entry("very low", 1), Map.entry("low", 2), Map.entry("medium", 3),
        Map.entry("moderate", 3), Map.entry("high", 4), Map.entry("very high", 5),
        // canonical impact axis
        Map.entry("insignificant", 1), Map.entry("minor", 2), Map.entry("major", 4), Map.entry("severe", 5),
        // canonical likelihood axis
        Map.entry("rare", 1), Map.entry("unlikely", 2), Map.entry("possible", 3),
        Map.entry("likely", 4), Map.entry("almost certain", 5));

    private RiskBands() {}

    /** 1..5, or 0 when the label is missing or unknown. */
    public static int level(String label) {
        if (label == null) return 0;
        return LEVELS.getOrDefault(label.trim().toLowerCase(Locale.ROOT), 0);
    }

    /** Band for likelihood × impact, or null when either rating is missing/unknown. */
    public static String band(String likelihood, String impact) {
        int l = level(likelihood);
        int i = level(impact);
        if (l == 0 || i == 0) return null;
        int score = l * i;
        if (score >= 18) return CRITICAL;
        if (score >= 12) return HIGH;
        if (score >= 6) return MODERATE;
        return LOW;
    }

    /**
     * The band the toolkit importer produced before the fix: 3×3 cut-offs applied to a 5×5 score,
     * so anything ≥10 (e.g. High × Medium = 12) came out Critical. Used only by the data repairs to
     * recognise ratings that were never changed by a user.
     */
    public static String legacyToolkitBand(String likelihood, String impact) {
        int l = toolkitLevel(likelihood);
        int i = toolkitLevel(impact);
        if (l <= 0 || i <= 0) return null;
        int score = l * i;
        if (score <= 3) return LOW;
        if (score <= 6) return MODERATE;
        if (score <= 9) return HIGH;
        return CRITICAL;
    }

    private static int toolkitLevel(String label) {
        if (label == null) return 0;
        return switch (label.toLowerCase(Locale.ROOT).trim()) {
            case "very low" -> 1;
            case "low" -> 2;
            case "medium", "moderate" -> 3;
            case "high" -> 4;
            case "very high" -> 5;
            default -> 0;
        };
    }
}
