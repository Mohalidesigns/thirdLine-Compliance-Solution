package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationPoint;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Splits a verbatim description or an interpreted statement into structured points.
 *
 * <p>Markers may be line-leading (one marker per line) or <b>inline</b> — several list
 * items on one line, which is how the toolkit seed and the classifier emit them, e.g.
 * {@code "All banks shall: (a) accept students; (b) keep records; and (c) report."}.
 * A marker is only recognised as a real list marker at the start of the text or after
 * whitespace / {@code ; : — –}; a marker that only occurs inside a word ("c" in
 * "accept") or only as a cross-reference ("paragraphs (b) to (g)", "Article 31 (1)")
 * is ignored. A span ends at the next sibling/broader marker.
 */
public class ObligationPointParser {

    /** Any list marker: (m) | m) | m. | m] | a bare dotted number. */
    private static final Pattern MARKER_RE = Pattern.compile(
        "(?<![^\\s;:\\u2014\\u2013])"
            + "(?:\\(\\s*([A-Za-z]{1,6}|\\d{1,3})\\s*\\)"
            + "|([A-Za-z]{1,6}|\\d{1,3}(?:\\.\\d{1,3}){0,3})[.)\\]](?=\\s)"
            + "|(\\d{1,3}(?:\\.\\d{1,3}){1,3})(?=\\s))"
    );

    private static final Pattern MARKER_CORE = Pattern.compile("[A-Za-z]{1,6}|\\d{1,3}(?:\\.\\d{1,3}){0,3}");
    private static final Pattern ROMAN = Pattern.compile("(?i)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})");
    private static final Pattern LIST_ROMAN = Pattern.compile("(?i)[ivx]+");

    /** Words that make a preceding marker a cross-reference rather than a list item. */
    private static final java.util.Set<String> REFERENCE_WORDS = java.util.Set.of(
        "section", "sections", "subsection", "subsections", "sub-section", "sub-sections", "s", "ss", "sec",
        "paragraph", "paragraphs", "subparagraph", "subparagraphs", "sub-paragraph", "para", "paras",
        "article", "articles", "art", "regulation", "regulations", "reg", "regs", "rule", "rules",
        "clause", "clauses", "schedule", "schedules", "part", "parts", "item", "items", "chapter", "chapters",
        "to", "in", "of", "under", "with", "see", "per");

    private enum Family { DIGIT, LOWER_ALPHA, UPPER_ALPHA, LOWER_ROMAN, UPPER_ROMAN }

    public static List<ObligationPoint> parse(String text, Long obligationId, String pointType) {
        if (text == null || text.isBlank()) return List.of();

        String normalized = text.replace("\r\n", "\n");
        List<ParsedLine> lines = new ArrayList<>();

        // ── Lead-in: text before the first real marker is a marker-less level-0 point ──
        int firstMarker = findMarker(normalized, null, 0);
        String leadIn = firstMarker < 0 ? normalized : normalized.substring(0, firstMarker);
        leadIn = leadIn.trim();
        if (!leadIn.isEmpty()) {
            ParsedLine pl = new ParsedLine();
            pl.level = 0;
            pl.marker = null;
            pl.content = leadIn;
            lines.add(pl);
        }
        if (firstMarker < 0) return toPoints(lines, obligationId, pointType);

        // ── Walk every real marker; each span runs to the next span-starting marker ──
        List<int[]> spans = new ArrayList<>();   // {start, markerTokenStart, contentStart}
        int cursor = firstMarker;
        while (cursor >= 0 && cursor < normalized.length()) {
            int tokenStart = cursor;
            Matcher m = MARKER_RE.matcher(normalized);
            if (!m.find(cursor) || m.start() != cursor) { cursor = findMarker(normalized, null, cursor + 1); continue; }
            int contentStart = m.end();
            // advance to the next marker that continues or starts a new span
            int next = findSpanEnd(normalized, cursor, contentStart);
            spans.add(new int[]{cursor, tokenStart, contentStart, next});
            cursor = next;
        }

        for (int[] s : spans) {
            String core = extractCore(normalized, s[1], s[2]);
            int level = levelOf(core);
            String content = normalized.substring(s[2], s[3]).trim();
            ParsedLine pl = new ParsedLine();
            pl.level = level;
            pl.marker = core;
            pl.content = content;
            lines.add(pl);
        }
        return toPoints(lines, obligationId, pointType);
    }

    private static List<ObligationPoint> toPoints(List<ParsedLine> lines, Long obligationId, String pointType) {
        List<ObligationPoint> result = new ArrayList<>();
        int order = 0;
        for (ParsedLine pl : lines) {
            ObligationPoint point = ObligationPoint.builder()
                .obligationId(obligationId)
                .pointType(pointType)
                .sortOrder(order++)
                .level(pl.level)
                .marker(pl.marker)
                .content(pl.content.trim())
                .build();
            result.add(point);
        }
        return result;
    }

    // ── marker discovery ──

    /** Index of the next real list marker at/after {@code from}; -1 when none. */
    private static int findMarker(String text, String ignored, int from) {
        Matcher m = MARKER_RE.matcher(text);
        int pos = Math.max(0, from);
        while (m.find(pos)) {
            String cand = groupCore(m);
            boolean paren = m.group(1) != null;
            if (isPlausible(cand) && !isCrossReference(text, m.start(), paren)) return m.start();
            pos = m.start() + 1;
        }
        return -1;
    }

    /**
     * The next marker that ends the span starting at {@code ownStart} (its start index):
     * a sibling (same family, later ordinal) or a broader marker (lower family rank).
     */
    private static int findSpanEnd(String text, int ownStart, int contentStart) {
        String own = coreAt(text, ownStart);
        Family ownFam = familyOfOwn(own, text, ownStart);
        Matcher m = MARKER_RE.matcher(text);
        int pos = contentStart;
        while (m.find(pos)) {
            String cand = groupCore(m);
            boolean paren = m.group(1) != null;
            if (isPlausible(cand) && !isCrossReference(text, m.start(), paren)
                    && endsSpan(own, ownFam, cand, text, m.start())) {
                return m.start();
            }
            pos = m.start() + 1;
        }
        return text.length();
    }

    private static String coreAt(String text, int start) {
        Matcher m = MARKER_RE.matcher(text);
        if (m.find(start) && m.start() == start) return groupCore(m);
        return "";
    }

    private static String extractCore(String text, int tokenStart, int contentStart) {
        String token = text.substring(tokenStart, contentStart).trim();
        return token.replaceAll("[()\\[\\]\\s]", "").replaceAll("\\.+$", "");
    }

    private static String groupCore(Matcher m) {
        String g = m.group(1) != null ? m.group(1) : (m.group(2) != null ? m.group(2) : m.group(3));
        return g == null ? null : g.trim();
    }

    // ── span rules ──

    private static boolean endsSpan(String own, Family ownFam, String cand, String text, int candStart) {
        Family cf = familyOfCand(cand, ownFam, own);
        if (cf == Family.DIGIT && ownFam == Family.DIGIT) {
            int od = depth(own), cd = depth(cand);
            if (cd > od) return false;             // "7.1.1" lives inside "7.1"
            if (cd < od) return true;              // "8" follows "7.1"
            return compareDotted(cand, own) > 0;   // "7.2" follows "7.1"
        }
        if (cf == ownFam) return ordinal(cand, cf) > ordinal(own, ownFam);
        return rank(cf) < rank(ownFam);
    }

    /** A lone i/v/x is a letter when its predecessor letter is itself a marker before it. */
    private static Family familyOfOwn(String core, String text, int start) {
        if (core.length() == 1 && LIST_ROMAN.matcher(core).matches()) {
            char prev = (char) (core.charAt(0) - 1);
            if (findMarker(text.substring(0, start), null, 0) >= 0
                || findMarker(text, String.valueOf(prev), 0) >= 0) {
                return alpha(core);
            }
            return roman(core);
        }
        return baseFamily(core);
    }

    /** "(i) nine" directly after "(h) eight" is the ninth letter, a sibling of (h). */
    private static Family familyOfCand(String cand, Family ownFam, String own) {
        if (cand.length() == 1 && LIST_ROMAN.matcher(cand).matches()
            && (ownFam == Family.LOWER_ALPHA || ownFam == Family.UPPER_ALPHA)
            && own.length() == 1 && cand.charAt(0) == own.charAt(0) + 1) {
            return alpha(cand);
        }
        return baseFamily(cand);
    }

    private static Family baseFamily(String core) {
        if (core == null || core.isEmpty()) return Family.DIGIT;
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
        String low = s.toLowerCase();
        if (f == Family.DIGIT) return Integer.parseInt(low.split("\\.")[0]);
        if (f == Family.LOWER_ROMAN || f == Family.UPPER_ROMAN) return romanValue(low);
        int v = 0;
        for (int i = 0; i < low.length(); i++) v = v * 26 + (low.charAt(i) - 'a' + 1);
        return v;
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

    private static int levelOf(String core) {
        if (core == null || core.isEmpty()) return 0;
        Family f = baseFamily(core);
        return switch (f) {
            case DIGIT -> "7.1".equals(core) || core.contains(".") ? 1 : 0;
            case UPPER_ROMAN, LOWER_ROMAN -> 2;
            default -> 1;
        };
    }

    private static boolean isPlausible(String core) {
        if (core == null || core.isEmpty()) return false;
        if (Character.isDigit(core.charAt(0))) return true;
        if (core.length() == 1) return true;
        if (core.length() == 2 && core.charAt(0) == core.charAt(1)) return true;
        return LIST_ROMAN.matcher(core).matches() && ROMAN.matcher(core).matches();
    }

    private static boolean isCrossReference(String text, int idx, boolean paren) {
        int i = idx - 1;
        while (i >= 0 && Character.isWhitespace(text.charAt(i))) i--;
        if (i < 0) return false;
        if (paren && Character.isDigit(text.charAt(i))) return true;   // "Article 31 (1)"
        int j = i;
        while (j >= 0 && (Character.isLetter(text.charAt(j)) || text.charAt(j) == '-')) j--;
        if (j == i) return false;
        String word = text.substring(j + 1, i + 1).toLowerCase();
        return REFERENCE_WORDS.contains(word);
    }

    private static class ParsedLine {
        int level;
        String marker;
        String content;
    }
}