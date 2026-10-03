package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.service.DueRule;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnService;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.imports.handler.ImportParsing.*;

/**
 * Bulk import of regulatory returns into the Returns register. Each return's filing cycle is anchored on
 * its First Due Date (see {@code ReturnService.ensureInstances}); obligation links go into
 * {@code obligation_returns}.
 */
@Component
@RequiredArgsConstructor
public class ReturnImportHandler implements ImportHandler {

    static final String TYPE = "returns";

    // Column indexes — must match COLUMNS order.
    private static final int NAME = 0, REGULATOR = 1, FREQUENCY = 2, FIRST_DUE = 3, PREP_DAYS = 4, ACT = 5,
        RETURN_TYPE = 6, CHANNEL = 7, UNIT = 8, PERSON = 9, OWNER_EMAIL = 10, LINKED_OBLIGATIONS = 11;

    private static final List<ImportColumn> COLUMNS = List.of(
        new ImportColumn("Return Name", true),
        new ImportColumn("Regulator", true),
        new ImportColumn("Frequency", true),
        new ImportColumn("First Due Date", false),
        new ImportColumn("Prep Days Before Due", false),
        new ImportColumn("Act / Regulation", false),
        new ImportColumn("Return Type", false),
        new ImportColumn("Filing Channel", false),
        new ImportColumn("Responsible Unit", false),
        new ImportColumn("Responsible Person", false),
        new ImportColumn("Return Owner (email)", false),
        new ImportColumn("Linked Obligation IDs", false, true));

    /** return_type is VARCHAR(100); return_name is TEXT but capped to keep the register readable. */
    private static final Map<Integer, Integer> MAX_LENGTH = Map.of(NAME, 1000, RETURN_TYPE, 100);
    /** regulatory_returns.filing_regulator is VARCHAR(100). */
    private static final int REGULATOR_SNAPSHOT_MAX = 100;

    /** The due month matters for these, so a First Due Date is required. */
    private static final Set<ReturnFrequency> DATE_REQUIRED = EnumSet.of(ReturnFrequency.QUARTERLY,
        ReturnFrequency.SEMI_ANNUAL, ReturnFrequency.ANNUAL, ReturnFrequency.BIENNIAL);

    private static final int DEFAULT_PREP_DAYS = 5;

    private final RegulatoryReturnRepository returnRepo;
    private final ObligationRepository obligationRepo;
    private final TenantRegulatorRepository regulatorRepo;
    private final UserRepository userRepo;
    private final TenantIdentityService tenantIdentity;
    private final ReturnService returnService;
    private final ObligationService obligationService;
    private final AuditService audit;

    // ------------------------------------------------------------------ template

    @Override public String entityType() { return TYPE; }

    @Override public String sheetName() { return "Returns"; }

    @Override public List<ImportColumn> columns() { return COLUMNS; }

    /** Same roles as {@code POST /returns}. */
    @Override public Set<String> requiredRoles() { return Set.of("CCO", "TENANT_ADMIN"); }

    @Override
    public LinkedHashMap<String, List<String>> allowedValues() {
        LinkedHashMap<String, List<String>> m = new LinkedHashMap<>();
        m.put("Regulator", activeRegulators(regulatorRepo, tenantIdentity).stream()
            .map(ImportParsing::regulatorLabel).distinct().toList());
        m.put("Frequency", ReturnFrequency.LABELS);
        return m;
    }

    @Override
    public List<ReferenceSheet> referenceSheets() {
        return List.of(obligationsReferenceSheet(obligationService));
    }

    @Override
    public List<String> exampleRow() {
        return List.of(
            "Monthly AML/CFT return",
            "CBN",
            "Monthly",
            "2026-10-15",
            "5",
            "CBN AML/CFT Regulations 2022",
            "Statutory",
            "eFASS portal",
            "Compliance",
            "Jane Doe",
            "jane.doe@example.com",
            "12; 345 (IDs from the 'Obligations' sheet)");
    }

    // ------------------------------------------------------------------ validate

    @Override
    public void validate(List<ImportRowData> rows) {
        validateInternal(rows, loadLookups(rows));
    }

    /** Parsed, resolved values of a valid row. */
    private record Parsed(String name, TenantRegulator regulator, ReturnFrequency frequency, LocalDate firstDue,
                          int prepDays, User owner, List<Long> obligationIds) {}

    private record Lookups(Map<String, TenantRegulator> regulators, Map<String, User> usersByEmail,
                           Set<Long> liveObligationIds, Set<String> existingKeys) {}

    private Lookups loadLookups(List<ImportRowData> rows) {
        Map<String, TenantRegulator> regulators = regulatorLookup(activeRegulators(regulatorRepo, tenantIdentity));

        Map<String, User> users = new HashMap<>();
        userRepo.findByIsActiveTrue().forEach(u -> {
            if (u.getEmail() != null) users.putIfAbsent(norm(u.getEmail()), u);
        });

        Set<Long> requested = new HashSet<>();
        for (ImportRowData row : rows) requested.addAll(parseIds(row.value(LINKED_OBLIGATIONS)).ids());
        Set<Long> live = requested.isEmpty() ? Set.of() : obligationRepo.findAllById(requested).stream()
            .filter(o -> !"deleted".equals(o.getStatus()))
            .map(Obligation::getObligationId)
            .collect(Collectors.toSet());

        Set<String> existing = returnRepo.findAll().stream()
            .filter(r -> r.getStatus() != RegulatoryReturnStatus.INACTIVE)
            .map(r -> dedupKey(r.getReturnName(), r.getTenantRegulatorId()))
            .collect(Collectors.toSet());
        return new Lookups(regulators, users, live, existing);
    }

    private Map<ImportRowData, Parsed> validateInternal(List<ImportRowData> rows, Lookups lk) {
        Map<ImportRowData, Parsed> parsedRows = new IdentityHashMap<>();
        Map<String, Integer> seenInFile = new HashMap<>();
        for (ImportRowData row : rows) {
            List<String> errors = new ArrayList<>();

            String name = row.value(NAME);
            if (name == null) errors.add("Return Name is required");

            MAX_LENGTH.forEach((col, max) -> {
                String v = row.value(col);
                if (v != null && v.length() > max)
                    errors.add(COLUMNS.get(col).header() + " is longer than " + max + " characters");
            });

            String regRaw = row.value(REGULATOR);
            TenantRegulator regulator = null;
            if (regRaw == null) {
                errors.add("Regulator is required");
            } else {
                regulator = lk.regulators().get(norm(regRaw));
                if (regulator == null)
                    errors.add("Regulator '" + regRaw + "' does not match any of your active regulators (name or abbreviation)");
            }

            String freqRaw = row.value(FREQUENCY);
            ReturnFrequency frequency = null;
            if (freqRaw == null) {
                errors.add("Frequency is required");
            } else {
                frequency = ReturnFrequency.fromLabel(freqRaw).orElse(null);
                if (frequency == null)
                    errors.add("Frequency '" + freqRaw + "' must be one of " + String.join(", ", ReturnFrequency.LABELS));
            }

            LocalDate firstDue = null;
            String dateRaw = row.value(FIRST_DUE);
            if (frequency != ReturnFrequency.EVENT_DRIVEN) {
                if (dateRaw != null) {
                    firstDue = parseDate(dateRaw);
                    if (firstDue == null)
                        errors.add("First Due Date '" + dateRaw + "' is not a valid date (use yyyy-MM-dd or dd/MM/yyyy)");
                } else if (frequency != null && DATE_REQUIRED.contains(frequency)) {
                    errors.add("First Due Date is required for " + frequency.label()
                        + " returns (it sets the month the return falls due)");
                }
            }

            int prepDays = DEFAULT_PREP_DAYS;
            String prepRaw = row.value(PREP_DAYS);
            if (prepRaw != null) {
                Integer v = parsePositiveInt(prepRaw);
                if (v == null) errors.add("Prep Days Before Due '" + prepRaw + "' must be a positive whole number");
                else prepDays = v;
            }

            User owner = null;
            String ownerRaw = row.value(OWNER_EMAIL);
            if (ownerRaw != null) {
                owner = lk.usersByEmail().get(norm(ownerRaw));
                if (owner == null) errors.add("Return Owner '" + ownerRaw + "' does not match an active user's email");
            }

            ParsedIds ids = parseIds(row.value(LINKED_OBLIGATIONS));
            if (!ids.badTokens().isEmpty())
                errors.add("Linked Obligation IDs contains values that are not whole numbers: "
                    + String.join(", ", ids.badTokens()) + " (separate IDs with ';' or ',')");
            List<Long> unknown = ids.ids().stream().filter(id -> !lk.liveObligationIds().contains(id)).toList();
            if (!unknown.isEmpty())
                errors.add("Linked Obligation IDs not found in the register (or deleted): "
                    + unknown.stream().map(String::valueOf).collect(Collectors.joining(", ")));

            // display summary — filled for every row so invalid rows are still recognisable
            row.setPrimary(name);
            row.setSecondary(joinContext(regulator != null ? regulatorLabel(regulator) : regRaw,
                frequency != null ? frequency.label() : freqRaw));
            int linkCount = ids.ids().size();
            row.setContext(joinContext(
                frequency == ReturnFrequency.EVENT_DRIVEN ? "Event-driven"
                    : firstDue != null ? "First due " + firstDue : null,
                linkCount > 0 ? linkCount + " linked obligation" + (linkCount == 1 ? "" : "s") : null));
            row.setRisk(null);
            row.setCreatedId(null);

            if (!errors.isEmpty()) {
                row.setResult(ImportRowData.INVALID);
                row.setErrors(errors);
                continue;
            }

            String key = dedupKey(name, regulator.getId());
            if (lk.existingKeys().contains(key)) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of("Duplicate of a return already in the register (same name and regulator)")));
                continue;
            }
            Integer earlier = seenInFile.get(key);
            if (earlier != null) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of("Duplicate of row " + earlier + " in this file (same name and regulator)")));
                continue;
            }
            seenInFile.put(key, row.getRowNumber());

            row.setResult(ImportRowData.VALID);
            row.setErrors(new ArrayList<>());
            parsedRows.put(row, new Parsed(name, regulator, frequency, firstDue, prepDays, owner, ids.ids()));
        }
        return parsedRows;
    }

    // ------------------------------------------------------------------ persist

    @Override
    public int persist(List<ImportRowData> rows, Integer userId, Long batchId) {
        Lookups lk = loadLookups(rows);
        Map<ImportRowData, Parsed> parsedRows = validateInternal(rows, lk);
        List<ImportRowData> toImport = rows.stream().filter(parsedRows::containsKey).toList();
        if (toImport.isEmpty()) return 0;

        List<RegulatoryReturn> toSave = new ArrayList<>(toImport.size());
        for (ImportRowData row : toImport) {
            Parsed p = parsedRows.get(row);
            toSave.add(RegulatoryReturn.builder()
                .returnName(p.name())
                .filingRegulator(snapshot(regulatorLabel(p.regulator())))
                .tenantRegulatorId(p.regulator().getId())
                .actName(row.value(ACT))
                .returnType(row.value(RETURN_TYPE))
                .frequency(p.frequency().label())
                .frequencyType(p.frequency().name())
                .status(RegulatoryReturnStatus.ACTIVE)
                .filingDate(p.firstDue())
                .dueDateSource(p.firstDue() != null ? DueRule.SOURCE_USER : null)
                .filingDeadlineOffsetDays(p.prepDays())
                .filingChannel(row.value(CHANNEL))
                .returnOwnerUserId(p.owner() != null ? p.owner().getUserId() : null)
                .returnOwnerName(p.owner() != null ? p.owner().getFullName() : null)
                .responsibleUnit(row.value(UNIT))
                .responsiblePerson(row.value(PERSON))
                .build());
        }
        List<RegulatoryReturn> saved = returnRepo.saveAll(toSave);

        for (int i = 0; i < saved.size(); i++) {
            RegulatoryReturn r = saved.get(i);
            ImportRowData row = toImport.get(i);
            row.setCreatedId(r.getReturnId());
            // Daily returns are left to the scheduled maintenance (~120 instances each).
            if (parsedRows.get(row).frequency() != ReturnFrequency.DAILY) returnService.ensureInstances(r);
            for (Long obligationId : parsedRows.get(row).obligationIds())
                obligationRepo.insertReturnLink(obligationId, r.getReturnId());
        }

        List<Long> ids = saved.stream().map(RegulatoryReturn::getReturnId).toList();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("entityType", TYPE);
        details.put("count", ids.size());
        details.put("returnIds", ids);
        audit.log(userId, "returns_imported", "import_batch", batchId, details);
        return ids.size();
    }

    @Override
    public void afterCommit() {
        obligationService.evictRegisterCache();
    }

    // ------------------------------------------------------------------ helpers

    private static String snapshot(String label) {
        return label != null && label.length() > REGULATOR_SNAPSHOT_MAX ? label.substring(0, REGULATOR_SNAPSHOT_MAX) : label;
    }

    private static String dedupKey(String name, Long tenantRegulatorId) {
        return norm(name) + "|" + tenantRegulatorId;
    }
}
