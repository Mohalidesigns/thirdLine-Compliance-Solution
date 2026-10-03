package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.BatchPointsResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class VerbatimMarkerMatcherTest {

    private static final String LETTERED =
        "All banks shall: (a) accept students as customers; (b) keep records of every account; and (c) report to the CBN.";

    // ── the reported bug: an invented marker matched inside a word ──

    @Test
    void markerInsideWordIsRejected() {
        String text = "The institution shall accept students and keep their records.";
        assertNull(ToolkitImportService.extractExactSpan(text, "c", 1));
        assertEquals(-1, VerbatimMarkerMatcher.findMarker(text, "c", 0));
    }

    @Test
    void markerCIsTheRealListItemNotTheCInAccept() {
        // "c" occurs in "accept" before the real "(c)" marker — the span must start at "(c)".
        String span = ToolkitImportService.extractExactSpan(LETTERED, "c", 1);
        assertEquals("(c) report to the CBN.", span);
    }

    // ── lettered ──

    @Test
    void letteredParenthesisedMarkersSplitAtSiblings() {
        assertEquals("(a) accept students as customers;", ToolkitImportService.extractExactSpan(LETTERED, "a", 1));
        assertEquals("(b) keep records of every account; and", ToolkitImportService.extractExactSpan(LETTERED, "b", 1));
        assertEquals("accept students as customers;",
            ToolkitImportService.stripMarkerPrefix(ToolkitImportService.extractExactSpan(LETTERED, "a", 1), "a"));
    }

    @Test
    void letteredBareMarkersWithDotOrParen() {
        String dots = "FSPs shall: a. Build skills and confidence. b. Safeguard account information.";
        assertEquals("a. Build skills and confidence.", ToolkitImportService.extractExactSpan(dots, "a", 1));
        assertEquals("b. Safeguard account information.", ToolkitImportService.extractExactSpan(dots, "b", 1));

        String parens = "it is mandatory to: a) Carry out a DPIA; b) Ensure privacy by design.";
        assertEquals("a) Carry out a DPIA;", ToolkitImportService.extractExactSpan(parens, "a", 1));
        assertEquals("Carry out a DPIA;", ToolkitImportService.stripMarkerPrefix("a) Carry out a DPIA;", "a"));
    }

    @Test
    void markerGivenWithParenthesesIsNormalised() {
        assertEquals("(b) keep records of every account; and", ToolkitImportService.extractExactSpan(LETTERED, "(b)", 1));
    }

    // ── roman ──

    @Test
    void romanMarkersAndLetterIAfterH() {
        String roman = "Where the reserve is: (i) less than the capital, transfer 30%; (ii) equal to the capital, transfer 15%; (iii) above it, transfer 10%.";
        assertEquals("(i) less than the capital, transfer 30%;", ToolkitImportService.extractExactSpan(roman, "i", 2));
        assertEquals("(ii) equal to the capital, transfer 15%;", ToolkitImportService.extractExactSpan(roman, "ii", 2));
        assertEquals("(iii) above it, transfer 10%.", ToolkitImportService.extractExactSpan(roman, "iii", 2));

        String bareRoman = "Where the reserve is; i. less than the capital; and ii. equal to or above it.";
        assertEquals("i. less than the capital; and", ToolkitImportService.extractExactSpan(bareRoman, "i", 2));

        // (i) directly after (h) is the ninth letter, a sibling of (h) — not a roman child
        String letters = "(g) seven; (h) eight; (i) nine; (j) ten.";
        assertEquals("(h) eight;", ToolkitImportService.extractExactSpan(letters, "h", 1));
        assertEquals("(i) nine;", ToolkitImportService.extractExactSpan(letters, "i", 1));
    }

    // ── numbered ──

    @Test
    void numberedMarkers() {
        String numbered = "The Bank shall: 1. Maintain cash reserves with the CBN. 2. Hold specified liquid assets. 3. Report monthly.";
        assertEquals("1. Maintain cash reserves with the CBN.", ToolkitImportService.extractExactSpan(numbered, "1", 0));
        assertEquals("2. Hold specified liquid assets.", ToolkitImportService.extractExactSpan(numbered, "2", 0));

        String dotted = "Minimum standards: 7.1 Design consumer education programs. 7.2 Disseminate them widely. 8.0 Review annually.";
        assertEquals("7.1 Design consumer education programs.", ToolkitImportService.extractExactSpan(dotted, "7.1", 0));
        assertEquals("Design consumer education programs.", ToolkitImportService.stripMarkerPrefix("7.1 Design consumer education programs.", "7.1"));

        String paren = "(1)A data controller shall abide by the Act. (2)For the purposes of this GAID it is mandatory to comply.";
        assertEquals("(1)A data controller shall abide by the Act.", ToolkitImportService.extractExactSpan(paren, "1", 0));
    }

    @Test
    void numberInsideTextIsNotAMarker() {
        // "2" only appears inside "N2,000" and "12." — never as a list marker
        assertNull(ToolkitImportService.extractExactSpan("Pay a fine of N2,000 within 12 days.", "2", 0));
    }

    // ── nesting & cross-references ──

    @Test
    void nestedChildrenStayInsideTheParentAndParentRunsToNextSibling() {
        String text = "(1) Every institution shall— (a) develop programmes; and (b) keep a record of: (i) complex transactions; (ii) unusual patterns. (2) A report shall be kept.";
        String one = ToolkitImportService.extractExactSpan(text, "1", 0);
        assertEquals("(1) Every institution shall— (a) develop programmes; and (b) keep a record of: (i) complex transactions; (ii) unusual patterns.", one);

        BatchPointsResponse.PointItem ii = item("ii", 2, List.of());
        BatchPointsResponse.PointItem i = item("i", 2, List.of());
        BatchPointsResponse.PointItem b = item("b", 1, List.of(i, ii));
        BatchPointsResponse.PointItem a = item("a", 1, List.of());
        BatchPointsResponse.PointItem invented = item("c", 1, List.of());

        Map<String, Object> point = ToolkitImportService.toPointMapExact("1",
            ToolkitImportService.stripMarkerPrefix(one, "1"), 0, List.of(a, b, invented), "verbatim");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> kids = (List<Map<String, Object>>) point.get("children");
        assertEquals(2, kids.size(), "the invented (c) child must be dropped");
        assertEquals("develop programmes; and", kids.get(0).get("text"));
        assertEquals("keep a record of: (i) complex transactions; (ii) unusual patterns.", kids.get(1).get("text"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> grand = (List<Map<String, Object>>) kids.get(1).get("children");
        assertEquals("complex transactions;", grand.get(0).get("text"));
        assertEquals("unusual patterns.", grand.get(1).get("text"));
    }

    @Test
    void crossReferencesAreNotMarkers() {
        String text = "Ordinary Member, where the person does not satisfy paragraphs (b) to (g) of this section.";
        assertNull(ToolkitImportService.extractExactSpan(text, "b", 1));
        assertNull(ToolkitImportService.extractExactSpan(text, "g", 1));
        assertNull(ToolkitImportService.extractExactSpan("as referred to in Article 31 (1) of the Act", "1", 0));
    }

    @Test
    void preambleIsTextBeforeTheFirstMarker() {
        assertEquals("All banks shall:", ToolkitImportService.extractExactSpan(LETTERED, null, 0));
    }

    @Test
    void interpretedTextStartingWithArticleAIsNotStripped() {
        assertEquals("a bank must report", ToolkitImportService.stripMarkerPrefix("a bank must report", "a"));
        assertEquals("bank must report", ToolkitImportService.stripMarkerPrefix("(a) bank must report", "a"));
    }

    private static BatchPointsResponse.PointItem item(String marker, int level, List<BatchPointsResponse.PointItem> children) {
        BatchPointsResponse.PointItem p = new BatchPointsResponse.PointItem();
        p.setMarker(marker);
        p.setLevel(level);
        p.setChildren(children);
        return p;
    }
}
