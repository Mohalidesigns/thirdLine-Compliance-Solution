package com.atheris.compliance.tenant.backend.modules.imports.service;

import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.imports.handler.ImportColumn;
import com.atheris.compliance.tenant.backend.modules.imports.handler.ImportHandler;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

/** All Apache POI handling for bulk import: reading uploads and writing the template / error report. */
final class ImportWorkbooks {

    static final int MAX_DATA_ROWS = 5000;
    static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    private static final int MAX_CELL_CHARS = 32_767; // Excel's own cell limit
    static final String ALLOWED_VALUES_SHEET = "Allowed values";

    static {
        // Zip-bomb guards: reject entries that inflate more than 100x, or any entry over 100 MB.
        ZipSecureFile.setMinInflateRatio(0.01d);
        ZipSecureFile.setMaxEntrySize(100L * 1024 * 1024);
    }

    private ImportWorkbooks() {}

    // ------------------------------------------------------------------ read

    static List<ImportRowData> parse(MultipartFile file, ImportHandler handler) {
        String name = file.getOriginalFilename();
        if (file.isEmpty()) throw invalid("The uploaded file is empty");
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".xlsx"))
            throw invalid("Only .xlsx files are supported — download the template and save it as Excel Workbook (.xlsx)");
        if (file.getSize() > MAX_FILE_BYTES)
            throw invalid("The file is larger than " + (MAX_FILE_BYTES / (1024 * 1024)) + " MB");

        Workbook wb;
        try (InputStream in = file.getInputStream()) {
            wb = new XSSFWorkbook(in);
        } catch (IOException | RuntimeException e) {
            throw invalid("The file could not be read as an Excel .xlsx workbook");
        }
        try (wb) {
            return readRows(wb, handler);
        } catch (IOException e) {
            throw invalid("The file could not be read as an Excel .xlsx workbook");
        }
    }

    private static List<ImportRowData> readRows(Workbook wb, ImportHandler handler) {
        Sheet sheet = wb.getSheet(handler.sheetName());
        if (sheet == null) sheet = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
        if (sheet == null) throw invalid("The workbook has no sheets");

        DataFormatter fmt = new DataFormatter(Locale.ROOT);
        fmt.setUseCachedValuesForFormulaCells(true);

        Row header = sheet.getRow(0);
        if (header == null) throw invalid("The header row (row 1) is missing");
        Map<String, Integer> headerIndex = new HashMap<>();
        for (Cell cell : header) {
            String h = normalizeHeader(fmt.formatCellValue(cell));
            if (!h.isEmpty()) headerIndex.putIfAbsent(h, cell.getColumnIndex());
        }

        List<ImportColumn> columns = handler.columns();
        int[] colIndex = new int[columns.size()];
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < columns.size(); i++) {
            Integer idx = headerIndex.get(normalizeHeader(columns.get(i).header()));
            colIndex[i] = idx != null ? idx : -1;
            if (idx == null && columns.get(i).required()) missing.add(columns.get(i).header());
        }
        if (!missing.isEmpty())
            throw invalid("Missing required column(s): " + String.join(", ", missing));

        List<ImportRowData> rows = new ArrayList<>();
        for (int r = 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            List<String> values = new ArrayList<>(columns.size());
            boolean any = false;
            for (int idx : colIndex) {
                String v = idx < 0 ? null : read(row.getCell(idx), fmt);
                values.add(v);
                any |= v != null;
            }
            if (!any) continue;
            if (rows.size() >= MAX_DATA_ROWS)
                throw invalid("The file has more than " + MAX_DATA_ROWS + " data rows — split it into smaller files");
            rows.add(ImportRowData.builder().rowNumber(r + 1).values(values).build());
        }
        if (rows.isEmpty()) throw invalid("The file has no data rows");
        return rows;
    }

    private static String read(Cell cell, DataFormatter fmt) {
        if (cell == null) return null;
        String v;
        CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
        if (type == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            v = cell.getLocalDateTimeCellValue().toLocalDate().toString();
        } else {
            v = fmt.formatCellValue(cell);
        }
        if (v == null) return null;
        v = v.trim();
        if (v.isEmpty()) return null;
        return v.length() > MAX_CELL_CHARS ? v.substring(0, MAX_CELL_CHARS) : v;
    }

    /** Case-, space- and punctuation-insensitive header key ("Act / Regulation*" -> "actregulation"). */
    static String normalizeHeader(String h) {
        return h == null ? "" : h.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static ApiException invalid(String message) {
        return ApiException.badRequest("invalid_file", message);
    }

    // ------------------------------------------------------------------ write

    static byte[] template(ImportHandler handler) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = headerStyle(wb);
            List<ImportColumn> columns = handler.columns();

            Sheet data = wb.createSheet(handler.sheetName());
            Row h = data.createRow(0);
            for (int i = 0; i < columns.size(); i++) {
                Cell c = h.createCell(i);
                c.setCellValue(columns.get(i).templateHeader());
                c.setCellStyle(headerStyle);
                data.setColumnWidth(i, 24 * 256);
            }
            data.createFreezePane(0, 1);

            Sheet allowed = wb.createSheet(ALLOWED_VALUES_SHEET);
            LinkedHashMap<String, List<String>> lists = handler.allowedValues();
            Row ah = allowed.createRow(0);
            int col = 0;
            int longest = 0;
            DataValidationHelper dvHelper = data.getDataValidationHelper();
            for (Map.Entry<String, List<String>> e : lists.entrySet()) {
                Cell c = ah.createCell(col);
                c.setCellValue(e.getKey());
                c.setCellStyle(headerStyle);
                allowed.setColumnWidth(col, 28 * 256);
                List<String> values = e.getValue();
                for (int r = 0; r < values.size(); r++) {
                    Row row = allowed.getRow(r + 1) != null ? allowed.getRow(r + 1) : allowed.createRow(r + 1);
                    row.createCell(col).setCellValue(values.get(r));
                }
                longest = Math.max(longest, values.size());

                int dataCol = indexOfColumn(columns, e.getKey());
                if (dataCol >= 0 && !values.isEmpty()) {
                    String letter = CellReference.convertNumToColString(col);
                    String ref = "'" + ALLOWED_VALUES_SHEET + "'!$" + letter + "$2:$" + letter + "$" + (values.size() + 1);
                    DataValidation dv = dvHelper.createValidation(
                        dvHelper.createFormulaListConstraint(ref),
                        new CellRangeAddressList(1, MAX_DATA_ROWS, dataCol, dataCol));
                    dv.setShowErrorBox(true);
                    dv.setErrorStyle(DataValidation.ErrorStyle.STOP);
                    dv.createErrorBox("Invalid value", "Pick a value from the list (see the '" + ALLOWED_VALUES_SHEET + "' sheet).");
                    data.addValidationData(dv);
                }
                col++;
            }

            // Example row lives here (not on the data sheet) so it can never be imported by mistake.
            int r = longest + 3;
            Cell note = allowed.createRow(r).createCell(0);
            note.setCellValue("Example row (reference only — this sheet is never imported). Columns marked * are required.");
            note.setCellStyle(headerStyle);
            Row exHeader = allowed.createRow(r + 1);
            Row exRow = allowed.createRow(r + 2);
            List<String> example = handler.exampleRow();
            for (int i = 0; i < columns.size(); i++) {
                Cell c = exHeader.createCell(i);
                c.setCellValue(columns.get(i).templateHeader());
                c.setCellStyle(headerStyle);
                exRow.createCell(i).setCellValue(i < example.size() ? example.get(i) : "");
                if (i >= lists.size()) allowed.setColumnWidth(i, 24 * 256);
            }
            return toBytes(wb);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to build import template", e);
        }
    }

    static byte[] errorReport(ImportHandler handler, List<ImportRowData> invalidRows) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = headerStyle(wb);
            List<ImportColumn> columns = handler.columns();
            Sheet sheet = wb.createSheet("Errors");
            Row h = sheet.createRow(0);
            for (int i = 0; i <= columns.size(); i++) {
                Cell c = h.createCell(i);
                c.setCellValue(i < columns.size() ? columns.get(i).templateHeader() : "Error");
                c.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, (i < columns.size() ? 24 : 60) * 256);
            }
            sheet.createFreezePane(0, 1);
            int r = 1;
            for (ImportRowData row : invalidRows) {
                Row out = sheet.createRow(r++);
                for (int i = 0; i < columns.size(); i++) {
                    String v = row.value(i);
                    if (v != null) out.createCell(i).setCellValue(v);
                }
                List<String> errors = row.getErrors() != null ? row.getErrors() : List.of();
                out.createCell(columns.size()).setCellValue("Row " + row.getRowNumber() + ": " + String.join("; ", errors));
            }
            return toBytes(wb);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to build import error report", e);
        }
    }

    private static int indexOfColumn(List<ImportColumn> columns, String header) {
        for (int i = 0; i < columns.size(); i++)
            if (columns.get(i).header().equals(header)) return i;
        return -1;
    }

    private static CellStyle headerStyle(Workbook wb) {
        Font bold = wb.createFont();
        bold.setBold(true);
        CellStyle s = wb.createCellStyle();
        s.setFont(bold);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private static byte[] toBytes(Workbook wb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
