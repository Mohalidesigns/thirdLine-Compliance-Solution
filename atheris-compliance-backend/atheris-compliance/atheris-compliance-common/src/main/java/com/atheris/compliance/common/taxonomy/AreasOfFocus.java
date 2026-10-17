package com.atheris.compliance.common.taxonomy;

import java.util.Locale;
import java.util.Map;

/**
 * One area-of-focus vocabulary for instruments and obligations: the compliance-universe names
 * (the instrument sheet). Obligations inherit their instrument's area; only when the instrument
 * has none does the obligation's own toolkit-section area apply, mapped onto universe names.
 */
public final class AreasOfFocus {

    /** Bucket label for records with no area. */
    public static final String UNASSIGNED = "Unassigned";

    /**
     * The generic CRMP toolkit sheet. It is a sheet name, not an area, so it never counts as one —
     * it held ~half of all obligations as a catch-all.
     */
    public static final String GENERIC_TOOLKIT_SECTION = "Compliance Risk Management";

    /** Toolkit section names (and spelling variants) → universe names. Keys are lower-case. */
    private static final Map<String, String> ALIASES = Map.of(
        "aml/cft", "AML/CFT/CPF",
        "conduct risk", "People and Conduct Risk",
        "capital market", "Capital Market Operations",
        "financial reporting", "Financial Reporting");

    private AreasOfFocus() {}

    /** Universe name for an area, or null when blank or the generic CRMP sheet. */
    public static String canonical(String area) {
        if (area == null || area.isBlank()) return null;
        String trimmed = area.trim();
        if (trimmed.equalsIgnoreCase(GENERIC_TOOLKIT_SECTION)) return null;
        return ALIASES.getOrDefault(trimmed.toLowerCase(Locale.ROOT), trimmed);
    }

    /** An obligation's area: its instrument's area, else its own (toolkit-section) area. */
    public static String forObligation(String instrumentArea, String obligationArea) {
        String inherited = canonical(instrumentArea);
        return inherited != null ? inherited : canonical(obligationArea);
    }

    /** Display bucket: the canonical area, or {@link #UNASSIGNED}. */
    public static String bucket(String area) {
        String c = canonical(area);
        return c != null ? c : UNASSIGNED;
    }
}
