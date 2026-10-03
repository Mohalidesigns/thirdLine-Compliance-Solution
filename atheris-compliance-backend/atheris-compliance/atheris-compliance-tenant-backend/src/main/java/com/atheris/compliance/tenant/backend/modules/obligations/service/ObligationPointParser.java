package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationPoint;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ObligationPointParser {

    private static final Pattern MARKER_RE = Pattern.compile(
        "^\\s*(\\(\\d+(?:\\.\\d+)*\\)|\\d+(?:\\.\\d+)*\\.|\\([a-zA-Z]\\)|[a-zA-Z]\\.|\\([ivxIVX]+\\)|[ivxIVX]+\\.)(?:\\s+)"
    );

    public static List<ObligationPoint> parse(String text, Long obligationId, String pointType) {
        if (text == null || text.isBlank()) return List.of();

        List<ParsedLine> lines = new ArrayList<>();
        String[] rawLines = text.split("\\n");

        for (String raw : rawLines) {
            String trimmed = raw.trim();
            if (trimmed.isEmpty()) continue;

            ParsedLine pl = detectMarker(trimmed);
            if (pl != null) {
                lines.add(pl);
            } else if (!lines.isEmpty()) {
                ParsedLine last = lines.get(lines.size() - 1);
                last.content += " " + trimmed;
            } else {
                ParsedLine pl2 = new ParsedLine();
                pl2.level = 0;
                pl2.marker = null;
                pl2.content = trimmed;
                lines.add(pl2);
            }
        }

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

    private static ParsedLine detectMarker(String text) {
        Matcher m = MARKER_RE.matcher(text);
        if (!m.find()) return null;

        ParsedLine pl = new ParsedLine();
        pl.marker = m.group(1).trim();
        pl.content = text.substring(m.end());

        String marker = pl.marker.replaceAll("[\\(\\)]", "").trim();

        if (marker.matches("\\d+(\\.\\d+)*\\.")) {
            pl.level = marker.contains(".") ? 1 : 0;
        } else if (marker.matches("[a-zA-Z]\\.")) {
            pl.level = 1;
        } else if (marker.matches("\\([a-zA-Z]\\)")) {
            pl.level = 1;
        } else if (marker.matches("[ivxIVX]+\\.") || marker.matches("\\([ivxIVX]+\\)")) {
            pl.level = 2;
        } else {
            pl.level = 0;
        }
        return pl;
    }

    private static class ParsedLine {
        int level;
        String marker;
        String content;
    }
}
