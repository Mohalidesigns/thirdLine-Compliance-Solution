package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.dto.ObligationRegisterItem;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import org.apache.poi.ss.usermodel.DateUtil;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Cell parsing and lookup helpers shared by the import handlers. */
final class ImportParsing {

    private static final Pattern NUMERIC = Pattern.compile("^\\d+(\\.\\d+)?$");
    private static final Pattern ID_TOKEN = Pattern.compile("^\\d+(\\.0+)?$");
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("d/M/uuuu").withResolverStyle(ResolverStyle.STRICT);

    private ImportParsing() {}

    // ------------------------------------------------------------------ text

    static Map<String, String> buildAliases(List<String> canonical, Map<String, String> aliases) {
        Map<String, String> m = new HashMap<>();
        canonical.forEach(v -> m.put(norm(v), v));
        aliases.forEach((k, v) -> m.putIfAbsent(k, v));
        return Map.copyOf(m);
    }

    static String joinContext(String... parts) {
        String s = Arrays.stream(parts).filter(Objects::nonNull).filter(p -> !p.isBlank())
            .collect(Collectors.joining(" · "));
        return s.isEmpty() ? null : s;
    }

    /** Lowercase, collapse internal whitespace, trim; null becomes "". */
    static String norm(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /** Case-insensitive match to a canonical value; adds an error and returns null when unrecognised. */
    static String strict(String raw, Map<String, String> aliases, String header, List<String> canonical,
                         String hint, List<String> errors) {
        if (raw == null) return null;
        String v = aliases.get(norm(raw));
        if (v == null) errors.add(header + " '" + raw + "' must be one of " + String.join(", ", canonical) + hint);
        return v;
    }

    // ------------------------------------------------------------------ numbers / dates

    static Integer parsePositiveInt(String raw) {
        String s = raw.trim();
        if (s.matches("^\\d+(\\.0+)?$")) s = s.contains(".") ? s.substring(0, s.indexOf('.')) : s;
        try {
            int v = Integer.parseInt(s);
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Excel serial numbers, yyyy-MM-dd, and dd/MM/yyyy. Null when unparseable. */
    static LocalDate parseDate(String raw) {
        String s = raw.trim();
        if (NUMERIC.matcher(s).matches()) {
            double serial = Double.parseDouble(s);
            if (!DateUtil.isValidExcelDate(serial) || serial < 1) return null;
            return DateUtil.getLocalDateTime(serial).toLocalDate();
        }
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return LocalDate.parse(s, DMY);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    record ParsedIds(List<Long> ids, List<String> badTokens) {}

    /** Splits on ';' or ',' (a single numeric cell such as "12" or "12.0" is one id). Distinct, in order. */
    static ParsedIds parseIds(String raw) {
        if (raw == null) return new ParsedIds(List.of(), List.of());
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        List<String> bad = new ArrayList<>();
        for (String token : raw.split("[;,]")) {
            String t = token.trim();
            if (t.isEmpty()) continue;
            if (!ID_TOKEN.matcher(t).matches()) { bad.add(t); continue; }
            try {
                long id = Long.parseLong(t.contains(".") ? t.substring(0, t.indexOf('.')) : t);
                if (id <= 0) bad.add(t); else ids.add(id);
            } catch (NumberFormatException e) {
                bad.add(t);
            }
        }
        return new ParsedIds(List.copyOf(ids), bad);
    }

    // ------------------------------------------------------------------ regulators

    static List<TenantRegulator> activeRegulators(TenantRegulatorRepository regulatorRepo,
                                                  TenantIdentityService tenantIdentity) {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId != null) return regulatorRepo.findByTenantIdAndIsActiveTrue(tenantId);
        return regulatorRepo.findAll().stream().filter(r -> !Boolean.FALSE.equals(r.getIsActive())).toList();
    }

    /** Normalised name or abbreviation to regulator. */
    static Map<String, TenantRegulator> regulatorLookup(List<TenantRegulator> active) {
        Map<String, TenantRegulator> regulators = new HashMap<>();
        // names first so a name always wins over another regulator's identical abbreviation
        active.forEach(r -> { if (r.getName() != null) regulators.putIfAbsent(norm(r.getName()), r); });
        active.forEach(r -> { if (r.getAbbreviation() != null && !r.getAbbreviation().isBlank())
            regulators.putIfAbsent(norm(r.getAbbreviation()), r); });
        return regulators;
    }

    static String regulatorLabel(TenantRegulator r) {
        return r.getAbbreviation() != null && !r.getAbbreviation().isBlank() ? r.getAbbreviation() : r.getName();
    }

    // ------------------------------------------------------------------ reference sheets

    /** Read-only "Obligations" lookup sheet (id, title, section, regulator, act) for link columns. */
    static ImportHandler.ReferenceSheet obligationsReferenceSheet(ObligationService obligationService) {
        List<List<String>> rows = obligationService.registerRows().stream()
            .sorted(Comparator.comparing(ObligationRegisterItem::getObligationId,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .map(i -> Arrays.asList(
                i.getObligationId() != null ? String.valueOf(i.getObligationId()) : null,
                i.getTitle() != null ? i.getTitle() : i.getName(),
                i.getSectionReference(),
                i.getRegulatorAbbreviation() != null ? i.getRegulatorAbbreviation() : i.getRegulatorName(),
                i.getActName()))
            .toList();
        return new ImportHandler.ReferenceSheet("Obligations",
            List.of("Obligation ID", "Title", "Section", "Regulator", "Act"), rows);
    }

    /** Read-only "Controls" lookup sheet (control number, name, theme) for link columns; sorted by number. */
    static ImportHandler.ReferenceSheet controlsReferenceSheet(ControlRepository controlRepo) {
        List<List<String>> rows = controlRepo.findAll().stream()
            .filter(c -> c.getControlNumber() != null && !c.getControlNumber().isBlank())
            .sorted(Comparator.comparing(Control::getControlNumber, String.CASE_INSENSITIVE_ORDER))
            .map(c -> Arrays.asList(c.getControlNumber(), c.getName(), c.getTheme()))
            .toList();
        return new ImportHandler.ReferenceSheet("Controls", List.of("Control Number", "Name", "Theme"), rows);
    }
}
