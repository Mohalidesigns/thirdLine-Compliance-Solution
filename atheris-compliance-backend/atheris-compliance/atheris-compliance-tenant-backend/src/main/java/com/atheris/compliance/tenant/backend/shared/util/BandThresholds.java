package com.atheris.compliance.tenant.backend.shared.util;

import com.atheris.compliance.common.risk.RiskBands;

public final class BandThresholds {

    public static final int DEFAULT_MODERATE = 6;
    public static final int DEFAULT_HIGH = 12;
    public static final int DEFAULT_CRITICAL = 18;

    private static volatile int moderate = DEFAULT_MODERATE;
    private static volatile int high = DEFAULT_HIGH;
    private static volatile int critical = DEFAULT_CRITICAL;

    private BandThresholds() {}

    public static void apply(Integer moderate, Integer high, Integer critical) {
        BandThresholds.moderate = valid(moderate, DEFAULT_MODERATE);
        BandThresholds.high = valid(high, DEFAULT_HIGH);
        BandThresholds.critical = valid(critical, DEFAULT_CRITICAL);
    }

    public static void reset() {
        apply(null, null, null);
    }

    public static int moderate() { return moderate; }
    public static int high() { return high; }
    public static int critical() { return critical; }

    public static String band(int score) {
        return RiskBands.bandForScore(score, moderate, high, critical);
    }

    public static String bandByLabels(String likelihood, String impact) {
        int l = RiskBands.level(likelihood);
        int i = RiskBands.level(impact);
        if (l == 0 || i == 0) return null;
        return band(l * i);
    }

    private static int valid(Integer value, int fallback) {
        return value == null || value <= 0 ? fallback : value;
    }
}
