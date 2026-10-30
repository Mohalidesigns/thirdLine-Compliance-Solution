package com.atheris.compliance.common.obligations;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Natural key of a seeded obligation, shared by the intel toolkit import and the tenant seed so
 * both recognise the same duplicate: normalised title + normalised section + normalised verbatim
 * text (the interpreted text only when there is no verbatim text). Scope it yourself (act or
 * instrument) — the key does not include it.
 *
 * <p>The interpreted text is deliberately not part of the key: the toolkit repeats the same row on
 * the generic CRMP sheet and on a topical sheet with reworded interpretations ("must" vs "shall"),
 * which is how 128 duplicates got in. Sections compare without a leading "Section"/"Reg." label.
 * The title stays in the key: the same verbatim text under a different title is a different duty.
 */
public final class ObligationKey {

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern SECTION_LABEL = Pattern.compile(
        "^(sections?|sec\\.?|s\\.|regulations?|reg\\.?|articles?|art\\.?|paragraphs?|para\\.?)\\s*");

    private ObligationKey() {}

    /** The key, or null when the obligation has no text to compare. */
    public static String of(String title, String section, String verbatim, String interpreted) {
        String text = normalize(verbatim);
        if (text.isEmpty()) text = normalize(interpreted);
        if (text.isEmpty()) return null;
        return normalize(title) + '|' + normalizeSection(section) + '|' + text;
    }

    /** Lower case, every run of non-alphanumerics collapsed to one space. */
    public static String normalize(String s) {
        if (s == null) return "";
        return NON_ALNUM.matcher(s.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
    }

    /** "Section 18(1)" and "18(1)" compare equal. */
    public static String normalizeSection(String s) {
        if (s == null) return "";
        return normalize(SECTION_LABEL.matcher(s.trim().toLowerCase(Locale.ROOT)).replaceFirst(""));
    }
}
