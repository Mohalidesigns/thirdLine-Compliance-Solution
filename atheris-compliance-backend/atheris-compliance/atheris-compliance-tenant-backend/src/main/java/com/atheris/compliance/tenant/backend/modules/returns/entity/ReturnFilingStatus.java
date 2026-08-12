package com.atheris.compliance.tenant.backend.modules.returns.entity;

public enum ReturnFilingStatus {
    NOT_STARTED("Not Started"),
    IN_PROGRESS("In Progress"),
    SUBMITTED("Submitted"),
    SUBMITTED_LATE("Submitted Late");

    private final String db;

    ReturnFilingStatus(String db) { this.db = db; }

    public String db() { return db; }

    public static ReturnFilingStatus fromDb(String s) {
        for (ReturnFilingStatus v : values()) if (v.db.equalsIgnoreCase(s)) return v;
        throw new IllegalArgumentException("Unknown return status: " + s);
    }
}