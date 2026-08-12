package com.atheris.compliance.tenant.backend.modules.returns.entity;

public enum RegulatoryReturnStatus {
    ACTIVE("Active"),
    INACTIVE("Inactive");

    private final String db;

    RegulatoryReturnStatus(String db) { this.db = db; }

    public String db() { return db; }

    public static RegulatoryReturnStatus fromDb(String s) {
        for (RegulatoryReturnStatus v : values()) if (v.db.equalsIgnoreCase(s)) return v;
        throw new IllegalArgumentException("Unknown return status: " + s);
    }
}