package com.atheris.compliance.tenant.backend.modules.returns.entity;

public enum ReturnStage {
    NOT_STARTED("Not Started"),
    DATA_GATHERING("Data Gathering"),
    DRAFT("Draft"),
    REVIEW("Review"),
    COMPLETED("Completed");

    private final String db;

    ReturnStage(String db) { this.db = db; }

    public String db() { return db; }

    public static ReturnStage fromDb(String s) {
        if (s == null) return null;
        for (ReturnStage v : values()) if (v.db.equalsIgnoreCase(s)) return v;
        String t = s.trim().toLowerCase();
        if (t.equals("sign-off") || t.equals("signoff")) return REVIEW;
        if (t.equals("submitted") || t.equals("submitted late")) return COMPLETED;
        throw new IllegalArgumentException("Unknown stage: " + s);
    }
}
