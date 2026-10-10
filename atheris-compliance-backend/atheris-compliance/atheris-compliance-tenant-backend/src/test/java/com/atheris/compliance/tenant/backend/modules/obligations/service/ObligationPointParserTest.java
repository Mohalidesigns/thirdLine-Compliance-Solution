package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationPoint;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ObligationPointParserTest {

    private static final String LETTERED =
        "All banks shall: (a) accept students as customers; (b) keep records of every account; and (c) report to the CBN.";

    @Test
    void inlineMarkersSplitOnOneLine() {
        List<ObligationPoint> pts = ObligationPointParser.parse(LETTERED, 1L, "verbatim");
        // lead-in + three markers
        assertEquals(4, pts.size());
        assertEquals(null, pts.get(0).getMarker());
        assertEquals("All banks shall:", pts.get(0).getContent());
        assertEquals("a", pts.get(1).getMarker());
        assertEquals("accept students as customers;", pts.get(1).getContent());
        assertEquals("b", pts.get(2).getMarker());
        assertEquals("keep records of every account; and", pts.get(2).getContent());
        assertEquals("c", pts.get(3).getMarker());
        assertEquals("report to the CBN.", pts.get(3).getContent());
    }

    @Test
    void markerInsideWordIsNotAListMarker() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "The institution shall accept students and keep their records.", 1L, "verbatim");
        assertEquals(1, pts.size());
        assertNull(pts.get(0).getMarker());
    }

    @Test
    void crossReferencesAreNotMarkers() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "Ordinary Member, where the person does not satisfy paragraphs (b) to (g) of this section.",
            1L, "verbatim");
        assertEquals(1, pts.size());
        assertNull(pts.get(0).getMarker());
    }

    @Test
    void lineLeadingMarkersStillWork() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "1. Maintain cash reserves.\n2. Hold specified liquid assets.", 1L, "verbatim");
        assertEquals(2, pts.size());
        assertEquals("1", pts.get(0).getMarker());
        assertEquals("0", String.valueOf(pts.get(0).getLevel()));
        assertEquals("2", pts.get(1).getMarker());
    }

    @Test
    void romanAndLetterIAfterH() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "(g) seven; (h) eight; (i) nine; (j) ten.", 1L, "verbatim");
        assertEquals(4, pts.size());
        assertEquals("h", pts.get(1).getMarker());
        assertEquals("eight;", pts.get(1).getContent());
        assertEquals("i", pts.get(2).getMarker());
        assertEquals("nine;", pts.get(2).getContent());
    }

    @Test
    void numberedMarkersWithDottedSubLevels() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "Minimum standards: 7.1 Design consumer education programs. 8.0 Review annually.", 1L, "verbatim");
        assertEquals(3, pts.size());
        assertEquals("7.1", pts.get(1).getMarker());
        assertEquals("Design consumer education programs.", pts.get(1).getContent());
        assertEquals("8.0", pts.get(2).getMarker());
    }

    @Test
    void squareBracketMarkers() {
        List<ObligationPoint> pts = ObligationPointParser.parse(
            "The following documents are required: a] A formal application. b] The purpose of the request.",
            1L, "verbatim");
        assertEquals(3, pts.size());
        assertEquals("a", pts.get(1).getMarker());
        assertEquals("A formal application.", pts.get(1).getContent());
        assertEquals("b", pts.get(2).getMarker());
        assertEquals("The purpose of the request.", pts.get(2).getContent());
    }

    @Test
    void blankTextYieldsNoPoints() {
        assertTrue(ObligationPointParser.parse(null, 1L, "verbatim").isEmpty());
        assertTrue(ObligationPointParser.parse("   ", 1L, "verbatim").isEmpty());
    }
}