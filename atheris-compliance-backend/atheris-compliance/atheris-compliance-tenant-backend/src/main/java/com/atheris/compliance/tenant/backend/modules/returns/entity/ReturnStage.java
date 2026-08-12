package com.atheris.compliance.tenant.backend.modules.returns.entity;

public enum ReturnStage {
    NOT_STARTED("Not Started"),
    DATA_GATHERING("Data Gathering"),
    DRAFT("Draft"),
    REVIEW("Review"),
    SIGN_OFF("Sign-off"),
    SUBMITTED("Submitted");

    private final String db;

    ReturnStage(String db) { this.db = db; }

    public String db() { return db; }

    public static ReturnStage fromDb(String s) {
        for (ReturnStage v : values()) if (v.db.equalsIgnoreCase(s)) return v;
        throw new IllegalArgumentException("Unknown stage: " + s);
    }
}