package com.atheris.compliance.intelligence.backend.shared.text;

public final class TextCleaner {

    private TextCleaner() {
    }

    public static String stripMarkdown(String text) {
        if (text == null) return null;
        String out = text;
        out = out.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
        out = out.replaceAll("(?m)^\\s*[*+-]\\s+", "");
        out = out.replaceAll("(?m)^\\s{1,3}\\d+\\.\\s+", "");
        out = out.replaceAll("(?m)^\\s*#{1,6}\\s+", "");
        out = out.replace("`", "");
        out = out.replaceAll("\\*", "");
        out = out.replaceAll("\\s+", " ").trim();
        return out;
    }
}