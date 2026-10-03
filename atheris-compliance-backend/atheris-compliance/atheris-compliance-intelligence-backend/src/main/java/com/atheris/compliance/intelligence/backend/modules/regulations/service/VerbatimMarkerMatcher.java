package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Locates verbatim list points ("(a)", "b)", "c.", "(iii)", "1.", "7.1") inside an
 * obligation's verbatim description.
 *
 * The LLM only returns markers for verbatim points; the text is cut from the
 * description here, so a marker must exist as a REAL list marker — at the start of the
 * text or after whitespace / {@code ; : — –}, in one of the forms {@code (m)}, {@code m)},
 * {@code m.}, or a bare dotted number {@code 7.1} — and the span starts at that marker.
 * A marker that only occurs inside a word ("c" in "accept") or only as a cross-reference
 * ("paragraphs (b) to (g)", "Article 31 (1)") is not found, and the point is dropped.
 *
 * A span ends at the next sibling (same family, later in sequence, e.g. (b) after (a))
 * or at the next marker of a higher level (numbers above letters above roman numerals).
 */
final class VerbatimMarkerMatcher {

    private VerbatimMarkerMatcher() {
    }

    /** Characters allowed immediately before a marker (besides start of text). */
    private static final String BOUNDARY = "(?<![^\\s;:\\u2014\\u2013])";

    private static final Pattern MARKER_CORE = Pattern.compile("[A-Za-z]{1,6}|\\d{1,3}(?:\\.\\d{1,3}){0,3}");

    /** Any list marker: (m) | m. or m) followed by whitespace | bare dotted number followed by whitespace. */
    private static final Pattern ANY_MARKER = Pattern.compile(BOUNDARY
        + "(?:\\(\\s*([A-Za-z]{1,6}|\\d{1,3})\\s*\\)"
        + "|([A-Za-z]{1,6}|\\d{1,3}(?:\\.\\d{1,3}){0,3})[.)](?=\\s)"
        + "|(\\d{1,3}(?:\\.\\d{1,3}){1,3})(?=\\s))");

    private static final Pattern ROMAN = Pattern.compile("(?i)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})");
    private static final Pattern LIST_ROMAN = Pattern.compile("(?i)[ivx]+");

    /** Words that, right before a marker, make it a cross-reference rather than a list item. */
    private static final Set<String> REFERENCE_WORDS = Set.of(
        "section", "sections", "subsection", "subsections", "sub-section", "sub-sections", "s", "ss", "sec",
        "paragraph", "paragraphs", "subparagraph", "subparagraphs", "sub-paragraph", "para", "paras",
        "article", "articles", "art", "regulation", "regulations", "reg", "regs", "rule", "rules",
        "clause", "clauses", "schedule", "schedules", "part", "parts", "item", "items", "chapter", "chapters",
        "to", "in", "of", "under", "with", "see", "per");

    enum Family { DIGIT, LOWER_ALPHA, UPPER_ALPHA, LOWER_ROMAN, UPPER_ROMAN }

    /** "(c)", " c) ", "c." → "c"; null when the value cannot be a list marker. */
    static String normalizeMarker(String marker) {
        if (marker == null) return null;
        String m = marker.replaceAll("[()\\s]", "");
        while (m.endsWith(".") || m.endsWith(")")) m = m.substring(0, m.length() - 1);
        if (m.isEmpty() || !MARKER_CORE.matcher(m).matches() || !isPlausible(m)) return null;
        return m;
    }

    /** Digits, a single letter, a doubled letter ("aa") or a valid roman numeral — not a word like "No". */
    static boolean isPlausible(String core) {
        if (core == null || core.isEmpty()) return false;
        if (Character.isDigit(core.charAt(0))) return true;
        if (core.length() == 1) return true;
        if (core.length() == 2 && core.charAt(0) == core.charAt(1)) return true;
        return LIST_ROMAN.matcher(core).matches() && ROMAN.matcher(core).matches();
    }

    /**
     * Index where {@code marker} appears as a real list marker at or after {@code from},
     * or -1. Tries the exact case first, then case-insensitively.
     */
    static int findMarker(String text, String marker, int from) {
        String core = normalizeMarker(marker);
        if (text == null || core == null) return -1;
        int idx = findMarker(text, core, from, false);
        return idx >= 0 ? idx : findMarker(text, core, from, true);
    }

    private static int findMarker(String text, String core, int from, boolean ignoreCase) {
        String q = Pattern.quote(core);
        boolean dotted = core.indexOf('.') >= 0;
        String regex = BOUNDARY + "(?:\\(\\s*" + q + "\\s*\\)|" + q + "\\)|" + q + "\\.(?=\\s|$)"
            + (dotted ? "|" + q + "(?=\\s)" : "") + ")";
        Matcher m = Pattern.compile(regex, ignoreCase ? Pattern.CASE_INSENSITIVE : 0).matcher(text);
        int pos = Math.max(0, from);
        while (pos <= text.length() && m.find(pos)) {
            if (!isCrossReference(text, m.start(), text.charAt(m.start()) == '(')) return m.start();
            pos = m.start() + 1;
        }
        return -1;
    }

    /**
     * The verbatim span of {@code marker} (starting AT the marker) searched from
     * {@code from}, or null when the marker does not occur as a real list marker.
     */
    static String extractSpan(String text, String marker, int from) {
        int start = findMarker(text, marker, from);
        if (start < 0) return null;
        String core = normalizeMarker(marker);
        Matcher own = ANY_MARKER.matcher(text);
        int ownEnd = own.find(start) && own.start() == start ? own.end() : start + core.length();
        Family family = familyOf(core, text, start);
        int end = text.length();
        Matcher m = ANY_MARKER.matcher(text);
        int pos = ownEnd;
        while (pos < text.length() && m.find(pos)) {
            String cand = m.group(1) != null ? m.group(1) : m.group(2) != null ? m.group(2) : m.group(3);
            boolean paren = m.group(1) != null;
            if (isPlausible(cand) && !isCrossReference(text, m.start(), paren) && endsSpan(core, family, cand)) {
                end = m.start();
                break;
            }
            pos = m.start() + 1;
        }
        String span = text.substring(start, end).trim();
        return span.isEmpty() ? null : span;
    }

    /** Text before the first list marker (the lead-in), or the whole text when there is none. */
    static String preamble(String text) {
        if (text == null) return null;
        Matcher m = ANY_MARKER.matcher(text);
        int pos = 0;
        while (m.find(pos)) {
            String cand = m.group(1) != null ? m.group(1) : m.group(2) != null ? m.group(2) : m.group(3);
            if (isPlausible(cand) && !isCrossReference(text, m.start(), m.group(1) != null)) {
                return text.substring(0, m.start()).trim();
            }
            pos = m.start() + 1;
        }
        return text.trim();
    }

    /** Removes a leading "(m)", "m.", "m)" or "m:" (and a bare dotted "7.1") from {@code text}. */
    static String stripMarkerPrefix(String text, String marker) {
        if (text == null) return null;
        String core = normalizeMarker(marker);
        if (core == null) return text.trim();
        String out = text.replaceAll("^[\\s\\-\"]+", "");
        String q = Pattern.quote(core);
        out = out.replaceFirst("(?i)^\\(\\s*" + q + "\\s*\\)\\s*", "");
        out = out.replaceFirst("(?i)^" + q + "[.):](?:\\s+|$)", "");
        out = out.replaceFirst("(?i)^" + q + "\\s+-\\s+", "");
        if (core.indexOf('.') >= 0) out = out.replaceFirst("^" + q + "\\s+", "");
        return out.trim();
    }

    // ── internals ──

    private static boolean isCrossReference(String text, int idx, boolean paren) {
        int i = idx - 1;
        while (i >= 0 && Character.isWhitespace(text.charAt(i))) i--;
        if (i < 0) return false;
        // "Article 31 (1)" — a parenthesised marker right after a number is a sub-reference
        if (paren && Character.isDigit(text.charAt(i))) return true;
        int j = i;
        while (j >= 0 && (Character.isLetter(text.charAt(j)) || text.charAt(j) == '-')) j--;
        if (j == i) return false;
        String word = text.substring(j + 1, i + 1).toLowerCase(Locale.ROOT);
        return REFERENCE_WORDS.contains(word);
    }

    private static boolean endsSpan(String own, Family ownFamily, String cand) {
        Family cf = familyOf(cand, ownFamily, own);
        if (cf == Family.DIGIT && ownFamily == Family.DIGIT) {
            int od = depth(own), cd = depth(cand);
            if (cd > od) return false;                 // 7.1.1 inside 7.1
            if (cd < od) return true;                  // 8 after 7.1
            return compareDotted(cand, own) > 0;       // 7.2 after 7.1
        }
        if (cf == ownFamily) return ordinal(cand, cf) > ordinal(own, ownFamily);
        return rank(cf) < rank(ownFamily);
    }

    /** Family of the span's own marker; a lone i/v/x is a letter when its predecessor letter is a marker before it. */
    private static Family familyOf(String core, String text, int start) {
        if (core.length() == 1 && LIST_ROMAN.matcher(core).matches()) {
            char prev = (char) (core.charAt(0) - 1);
            String before = text.substring(0, start);
            if (findMarker(before, String.valueOf(prev), 0) >= 0) return alpha(core);
            return roman(core);
        }
        return baseFamily(core);
    }

    /** Family of a candidate marker; a lone i/v/x that directly follows the own letter is that letter's sibling. */
    private static Family familyOf(String cand, Family ownFamily, String own) {
        if (cand.length() == 1 && LIST_ROMAN.matcher(cand).matches()
                && (ownFamily == Family.LOWER_ALPHA || ownFamily == Family.UPPER_ALPHA)
                && own.length() == 1 && cand.charAt(0) == own.charAt(0) + 1) {
            return alpha(cand);
        }
        return baseFamily(cand);
    }

    private static Family baseFamily(String core) {
        if (Character.isDigit(core.charAt(0))) return Family.DIGIT;
        if (LIST_ROMAN.matcher(core).matches() && ROMAN.matcher(core).matches()) return roman(core);
        return alpha(core);
    }

    private static Family alpha(String s) {
        return Character.isUpperCase(s.charAt(0)) ? Family.UPPER_ALPHA : Family.LOWER_ALPHA;
    }

    private static Family roman(String s) {
        return Character.isUpperCase(s.charAt(0)) ? Family.UPPER_ROMAN : Family.LOWER_ROMAN;
    }

    private static int rank(Family f) {
        return switch (f) {
            case DIGIT -> 0;
            case UPPER_ALPHA, LOWER_ALPHA -> 1;
            case UPPER_ROMAN, LOWER_ROMAN -> 2;
        };
    }

    private static int depth(String dotted) {
        String s = dotted.replaceAll("(\\.0)+$", "");
        return s.split("\\.").length;
    }

    private static int compareDotted(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int xi = i < x.length ? Integer.parseInt(x[i]) : 0;
            int yi = i < y.length ? Integer.parseInt(y[i]) : 0;
            if (xi != yi) return Integer.compare(xi, yi);
        }
        return 0;
    }

    private static int ordinal(String s, Family f) {
        String low = s.toLowerCase(Locale.ROOT);
        return switch (f) {
            case DIGIT -> Integer.parseInt(low.split("\\.")[0]);
            case LOWER_ROMAN, UPPER_ROMAN -> romanValue(low);
            case LOWER_ALPHA, UPPER_ALPHA -> {
                int v = 0;
                for (char c : low.toCharArray()) v = v * 26 + (c - 'a' + 1);
                yield v;
            }
        };
    }

    private static int romanValue(String s) {
        int total = 0, prev = 0;
        for (int i = s.length() - 1; i >= 0; i--) {
            int v = switch (s.charAt(i)) {
                case 'i' -> 1; case 'v' -> 5; case 'x' -> 10; case 'l' -> 50;
                case 'c' -> 100; case 'd' -> 500; case 'm' -> 1000; default -> 0;
            };
            total += v < prev ? -v : v;
            prev = Math.max(prev, v);
        }
        return total;
    }
}
