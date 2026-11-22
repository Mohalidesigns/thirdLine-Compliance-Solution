package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderImportResult;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderTitle;
import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.TeamRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class StakeholderBulkImportService {

    private static final int MAX_ROWS = 5000;
    private static final String COL_NAME = "name";
    private static final String COL_EMAIL = "email";
    private static final String COL_TITLE = "title";
    private static final String COL_DEPARTMENT = "department";
    private static final String COL_UNIT = "unit";

    private final OwnerRepository stakeholders;
    private final StakeholderTitleService titles;
    private final DepartmentRepository departments;
    private final TeamRepository teams;

    /** Bulk-create/refresh placed stakeholders from a CSV or XLSX file. Idempotent by email. */
    @Transactional
    public StakeholderImportResult importFile(MultipartFile file) {
        List<List<String>> grid = readGrid(file);
        if (grid.isEmpty()) {
            throw ApiException.badRequest("empty_file", "The file has no rows");
        }
        Map<String, Integer> header = headerIndex(grid.get(0));
        int nameCol = require(header, COL_NAME);
        int emailCol = require(header, COL_EMAIL);
        int departmentCol = require(header, COL_DEPARTMENT);
        Integer titleCol = header.get(COL_TITLE);
        Integer unitCol = header.get(COL_UNIT);

        Map<String, Integer> departmentByName = departments.findAll().stream()
            .filter(d -> d.getName() != null)
            .collect(Collectors.toMap(d -> key(d.getName()), Department::getDepartmentId, (a, b) -> a));
        Map<String, Integer> unitByKey = teams.findAll().stream()
            .filter(t -> t.getName() != null)
            .collect(Collectors.toMap(t -> t.getDepartmentId() + "|" + key(t.getName()), Team::getTeamId, (a, b) -> a));
        Map<String, Owner> byEmail = stakeholders.findAll().stream()
            .filter(o -> o.getEmail() != null)
            .collect(Collectors.toMap(o -> key(o.getEmail()), o -> o, (a, b) -> a));

        int created = 0;
        int updated = 0;
        int skipped = 0;
        List<StakeholderImportResult.RowError> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (int i = 1; i < grid.size(); i++) {
            List<String> row = grid.get(i);
            int rowNumber = i + 1;
            if (isBlankRow(row)) {
                continue;
            }
            String name = cell(row, nameCol);
            String email = cell(row, emailCol);
            String department = cell(row, departmentCol);
            String unitName = unitCol != null ? cell(row, unitCol) : null;
            String titleName = titleCol != null ? cell(row, titleCol) : null;

            if (email == null || !email.contains("@")) {
                errors.add(err(rowNumber, "Email is required and must be valid"));
                skipped++;
                continue;
            }
            String emailKey = key(email);
            if (!seen.add(emailKey)) {
                errors.add(err(rowNumber, "Duplicate email in this file: " + email));
                skipped++;
                continue;
            }
            if (department == null) {
                errors.add(err(rowNumber, "Department is required"));
                skipped++;
                continue;
            }
            Integer departmentId = departmentByName.get(key(department));
            if (departmentId == null) {
                errors.add(err(rowNumber, "Unknown department '" + department + "'"));
                skipped++;
                continue;
            }
            Integer unitId = unitName != null ? unitByKey.get(departmentId + "|" + key(unitName)) : null;
            if (unitName != null && unitId == null) {
                errors.add(err(rowNumber, "Unit '" + unitName + "' is not part of " + department));
                skipped++;
                continue;
            }
            if (titleName != null && unitId == null) {
                StakeholderTitle existingTitle = titles.findByName(titleName);
                if (existingTitle != null) unitId = existingTitle.getDefaultUnitId();
            }
            Integer titleId = titleName != null
                ? titles.resolveOrCreate(titleName, departmentId, unitId).getTitleId() : null;

            Owner existing = byEmail.get(emailKey);
            if (existing == null) {
                Owner saved = stakeholders.save(Owner.builder()
                    .fullName(name != null ? name : email)
                    .email(email)
                    .titleId(titleId)
                    .departmentId(departmentId)
                    .teamId(unitId)
                    .isActive(true)
                    .build());
                byEmail.put(emailKey, saved);
                created++;
            } else {
                if (name != null) existing.setFullName(name);
                if (titleId != null) existing.setTitleId(titleId);
                existing.setDepartmentId(departmentId);
                if (unitId != null) existing.setTeamId(unitId);
                stakeholders.save(existing);
                updated++;
            }
            if (created + updated > MAX_ROWS) {
                throw ApiException.badRequest("too_many_rows", "At most " + MAX_ROWS + " stakeholders per file");
            }
        }

        log.info("[StakeholderBulkImport] created={} updated={} skipped={} file={}",
            created, updated, skipped, file.getOriginalFilename());
        return StakeholderImportResult.builder()
            .created(created).updated(updated).skipped(skipped).errors(errors).build();
    }

    public byte[] template() {
        List<Department> depts = departments.findAll();
        List<Team> allTeams = teams.findAll();
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Sheet data = wb.createSheet("Stakeholders");
            String[] headers = { COL_NAME + "*", COL_EMAIL + "*", COL_TITLE, COL_DEPARTMENT + "*", COL_UNIT };
            Row head = data.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell c = head.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
                data.setColumnWidth(i, 7500);
            }
            String exampleDept = depts.stream().map(Department::getName).filter(Objects::nonNull).findFirst().orElse("Compliance");
            String[] example = { "Jane Doe", "jane.doe@example.com", "Head of Compliance", exampleDept, "" };
            Row exampleRow = data.createRow(1);
            for (int i = 0; i < example.length; i++) {
                exampleRow.createCell(i).setCellValue(example[i]);
            }

            Sheet ref = wb.createSheet("Departments & units");
            Row refHead = ref.createRow(0);
            Cell refDeptCell = refHead.createCell(0);
            refDeptCell.setCellValue("Department (required)");
            refDeptCell.setCellStyle(headerStyle);
            Cell refUnitCell = refHead.createCell(1);
            refUnitCell.setCellValue("Unit (optional)");
            refUnitCell.setCellStyle(headerStyle);
            int r = 1;
            for (Department d : depts) {
                List<Team> ds = allTeams.stream().filter(t -> Objects.equals(t.getDepartmentId(), d.getDepartmentId())).toList();
                if (ds.isEmpty()) {
                    ref.createRow(r++).createCell(0).setCellValue(d.getName());
                } else {
                    for (Team t : ds) {
                        Row row = ref.createRow(r++);
                        row.createCell(0).setCellValue(d.getName());
                        row.createCell(1).setCellValue(t.getName());
                    }
                }
            }
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw ApiException.badRequest("template_failed", "Could not generate the template");
        }
    }

    private List<List<String>> readGrid(MultipartFile file) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        try (InputStream in = file.getInputStream()) {
            if (name.endsWith(".xlsx")) return readXlsx(in);
            if (name.endsWith(".csv")) return readCsv(in);
            throw ApiException.badRequest("unsupported_format", "Only .csv or .xlsx files are supported");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("unreadable_file", "The file could not be read as CSV or XLSX");
        }
    }

    private static List<List<String>> readXlsx(InputStream in) throws Exception {
        List<List<String>> out = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(in)) {
            Sheet sheet = wb.getSheetAt(0);
            DataFormatter fmt = new DataFormatter();
            for (Row row : sheet) {
                List<String> cells = new ArrayList<>();
                int last = row.getLastCellNum();
                for (int c = 0; c < last; c++) {
                    Cell cell = row.getCell(c);
                    cells.add(cell == null ? "" : fmt.formatCellValue(cell).trim());
                }
                out.add(cells);
            }
        }
        return out;
    }

    private static List<List<String>> readCsv(InputStream in) throws Exception {
        List<List<String>> out = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                out.add(parseCsvLine(line));
            }
        }
        return out;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    current.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                out.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        out.add(current.toString().trim());
        return out;
    }

    private static Map<String, Integer> headerIndex(List<String> header) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            map.putIfAbsent(headerKey(header.get(i)), i);
        }
        return map;
    }

    private static String headerKey(String value) {
        return key(value).replace("*", "").trim();
    }

    private static int require(Map<String, Integer> header, String column) {
        Integer idx = header.get(column);
        if (idx == null) {
            throw ApiException.badRequest("missing_column", "Missing required column: " + column);
        }
        return idx;
    }

    private static String cell(List<String> row, int idx) {
        if (idx < 0 || idx >= row.size()) return null;
        String value = row.get(idx);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static boolean isBlankRow(List<String> row) {
        return row.stream().allMatch(s -> s == null || s.isBlank());
    }

    private static String key(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static StakeholderImportResult.RowError err(int row, String message) {
        return StakeholderImportResult.RowError.builder().row(row).message(message).build();
    }
}
