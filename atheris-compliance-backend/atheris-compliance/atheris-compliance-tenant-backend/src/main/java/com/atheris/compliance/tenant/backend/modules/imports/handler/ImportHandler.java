package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import java.util.LinkedHashMap;
import java.util.List;

/**
 * Entity-specific half of bulk import. {@code ImportService} owns the file handling, batch storage
 * and transaction; a handler owns the template columns, row validation, duplicate detection and
 * the write. Adding controls/returns/findings later means adding one handler bean.
 */
public interface ImportHandler {

    /** URL/batch type, e.g. {@code obligations}. */
    String entityType();

    /** Name of the data sheet in the template. */
    String sheetName();

    /** Template columns in order. Raw row values are stored in this order. */
    List<ImportColumn> columns();

    /** Column header (without {@code *}) to allowed values, for template dropdowns and the "Allowed values" sheet. */
    LinkedHashMap<String, List<String>> allowedValues();

    /**
     * Column header (without {@code *}) to suggested values. Listed on the "Allowed values" sheet for
     * guidance only — unlike {@link #allowedValues()} no dropdown or validation is applied, so any text is accepted.
     */
    default LinkedHashMap<String, List<String>> suggestions() { return new LinkedHashMap<>(); }

    /** Extra read-only lookup sheets written after "Allowed values" (never imported). */
    default List<ReferenceSheet> referenceSheets() { return List.of(); }

    /** A read-only lookup sheet in the template. */
    record ReferenceSheet(String name, List<String> headers, List<List<String>> rows) {}

    /** One illustrative row (column order) shown on the "Allowed values" sheet, never imported. */
    List<String> exampleRow();

    /**
     * Validates every row in place: sets {@code result}, {@code errors} (all problems, not just the
     * first) and the display summary. Duplicates are checked against existing records and against
     * earlier rows of the same file.
     */
    void validate(List<ImportRowData> rows);

    /**
     * Re-validates the rows against current data, then persists those still valid. Runs inside the
     * caller's transaction. Sets {@code createdId} on each imported row and returns how many were imported.
     */
    int persist(List<ImportRowData> rows, Integer userId, Long batchId);

    /** Hook run after the commit transaction has committed (e.g. cache eviction). */
    default void afterCommit() {}
}
