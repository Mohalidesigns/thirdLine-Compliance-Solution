package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationPoint;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Proves the mapping from the baked toolkit JSON point shape (verbatim + interpreted,
 * flat with {@code level}, {@code marker}, {@code text}/{@code content}, {@code children})
 * to {@code ObligationPoint} rows — no Spring context, no DB.
 */
class RegulationSeedServiceConvertPointsTest {

    private static Map<String, Object> point(String type, String marker, int level, String text, List<Map<String, Object>> children) {
        Map<String, Object> p = new HashMap<>();
        p.put("pointType", type);
        p.put("marker", marker);
        p.put("level", level);
        p.put("text", text);
        p.put("content", text);
        p.put("children", children == null ? List.of() : children);
        return p;
    }

    @Test
    void mapsFlatVerbatimAndInterpretedBakedShape() {
        List<Map<String, Object>> points = List.of(
            point("verbatim", "a", 1, "accept students as customers;", null),
            point("verbatim", "b", 1, "keep records of every account.", null),
            point("interpreted", "1", 0, "The Bank shall onboard students.", null)
        );

        List<ObligationPoint> out = RegulationSeedService.convertPoints(points, 42L, 0);

        assertEquals(3, out.size());
        assertEquals(42L, out.get(0).getObligationId());
        assertEquals("verbatim", out.get(0).getPointType());
        assertEquals("a", out.get(0).getMarker());
        assertEquals(1, out.get(0).getLevel());
        assertEquals("accept students as customers;", out.get(0).getContent());
        assertEquals(1, out.get(0).getSortOrder());
        assertEquals(2, out.get(1).getSortOrder());
        assertEquals("interpreted", out.get(2).getPointType());
        assertEquals(3, out.get(2).getSortOrder());
    }

    @Test
    void fallsBackToContentWhenTextMissingAndDefaultsTypeAndLevel() {
        Map<String, Object> verbatim = new HashMap<>();
        verbatim.put("marker", "a");
        verbatim.put("content", "verbatim text only");
        Map<String, Object> noTypeNoLevel = new HashMap<>();
        noTypeNoLevel.put("text", "typed by fallback");

        List<ObligationPoint> out = RegulationSeedService.convertPoints(List.of(verbatim, noTypeNoLevel), 7L, 0);

        assertEquals("verbatim text only", out.get(0).getContent());
        assertEquals("verbatim", out.get(0).getPointType(), "missing pointType defaults to verbatim");
        assertEquals(0, out.get(0).getLevel());
        assertEquals("verbatim", out.get(1).getPointType(), "null pointType defaults to verbatim");
        assertEquals("typed by fallback", out.get(1).getContent());
    }

    @Test
    void mapsNestedChildrenAndAdvancesSortOrder() {
        Map<String, Object> i = point("verbatim", "i", 2, "complex transactions;", null);
        Map<String, Object> ii = point("verbatim", "ii", 2, "unusual patterns.", null);
        Map<String, Object> b = point("verbatim", "b", 1, "keep a record of:", List.of(i, ii));
        Map<String, Object> a = point("verbatim", "a", 1, "develop programmes; and", null);

        List<ObligationPoint> out = RegulationSeedService.convertPoints(new ArrayList<>(List.of(a, b)), 5L, 0);

        assertEquals(4, out.size());
        assertEquals(List.of("a", "b", "i", "ii"), out.stream().map(ObligationPoint::getMarker).toList());
        assertEquals(List.of(1, 2, 3, 4), out.stream().map(ObligationPoint::getSortOrder).toList());
        assertEquals(2, out.get(3).getLevel());
    }

    @Test
    void emptyOrNullPointsYieldNothing() {
        assertTrue(RegulationSeedService.convertPoints(List.of(), 1L, 0).isEmpty());
    }
}