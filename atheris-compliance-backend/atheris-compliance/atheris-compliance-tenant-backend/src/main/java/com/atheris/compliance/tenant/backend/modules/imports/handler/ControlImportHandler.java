package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.imports.handler.ImportParsing.*;

/**
 * Bulk import of controls into the Controls register. Links are written on both sides: the control's
 * {@code linkedObligationIds} and each linked obligation's {@code ObligationClassification.linkedControlIds}.
 */
@Component
@RequiredArgsConstructor
public class ControlImportHandler implements ImportHandler {

    static final String TYPE = "controls";

    // Column indexes — must match COLUMNS order.
    private static final int NAME = 0, NUMBER = 1, DESCRIPTION = 2, THEME = 3, CONTROL_TYPE = 4, FREQUENCY = 5,
        FREQUENCY_DAYS = 6, INHERENT_RISK = 7, OWNER = 8, WHAT_IT_DOES = 9, HOW_TESTED = 10, REG_REQUIREMENT = 11,
        COMPLIANCE_AREA = 12, ACT = 13, LINKED_OBLIGATIONS = 14;

    private static final List<ImportColumn> COLUMNS = List.of(
        new ImportColumn("Control Name", true),
        new ImportColumn("Control Number", false),
        new ImportColumn("Description", false),
        new ImportColumn("Theme", false),
        new ImportColumn("Control Type", false),
        new ImportColumn("Test Frequency", false),
        new ImportColumn("Test Frequency Days", false),
        new ImportColumn("Inherent Risk", false),
        new ImportColumn("Owner", false),
        new ImportColumn("What It Does", false),
        new ImportColumn("How Tested", false),
        new ImportColumn("Regulatory Requirement", false),
        new ImportColumn("Compliance Area", false),
        new ImportColumn("Act / Regulation", false),
        new ImportColumn("Linked Obligation IDs", false, true));

    /** Column widths of the target VARCHAR columns (control_tasks.control_name is VARCHAR(500)). */
    private static final Map<Integer, Integer> MAX_LENGTH = Map.of(NAME, 500, NUMBER, 100);

    static final List<String> CONTROL_TYPES = List.of("Preventive", "Detective", "Corrective", "Directive");
    static final List<String> FREQUENCIES = List.of("Monthly", "Quarterly", "Semi-Annual", "Annual");
    static final List<String> RISK_LEVELS = List.of("Critical", "High", "Moderate", "Low");
    static final List<String> THEME_SUGGESTIONS = List.of("IT", "Financial", "Operational", "Compliance", "Legal");
    private static final Map<String, Integer> FREQUENCY_DAYS_DEFAULT =
        Map.of("Monthly", 30, "Quarterly", 90, "Semi-Annual", 182, "Annual", 365);

    private static final Map<String, String> TYPE_ALIASES = buildAliases(CONTROL_TYPES, Map.of());
    private static final Map<String, String> FREQUENCY_ALIASES = buildAliases(FREQUENCIES,
        Map.of("semi annual", "Semi-Annual", "semiannual", "Semi-Annual"));
    private static final Map<String, String> RISK_ALIASES = buildAliases(RISK_LEVELS, Map.of("medium", "Moderate"));

    private static final Pattern GENERATED_NUMBER = Pattern.compile("(?i)^CTL-(\\d+)$");

    private final ControlRepository controlRepo;
    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classificationRepo;
    private final OwnerRepository ownerRepo;
    private final ObligationService obligationService;
    private final AuditService audit;

    // ------------------------------------------------------------------ template

    @Override public String entityType() { return TYPE; }

    @Override public String sheetName() { return "Controls"; }

    @Override public List<ImportColumn> columns() { return COLUMNS; }

    @Override
    public LinkedHashMap<String, List<String>> allowedValues() {
        LinkedHashMap<String, List<String>> m = new LinkedHashMap<>();
        m.put("Control Type", CONTROL_TYPES);
        m.put("Test Frequency", FREQUENCIES);
        m.put("Inherent Risk", RISK_LEVELS);
        m.put("Owner", ownerRepo.findByIsActiveTrueOrderByFullNameAsc().stream()
            .map(Owner::getFullName).filter(Objects::nonNull).distinct().toList());
        return m;
    }

    @Override
    public LinkedHashMap<String, List<String>> suggestions() {
        LinkedHashMap<String, List<String>> m = new LinkedHashMap<>();
        m.put("Theme", THEME_SUGGESTIONS);
        return m;
    }

    @Override
    public List<ReferenceSheet> referenceSheets() {
        return List.of(obligationsReferenceSheet(obligationService));
    }


    @Override
    public List<String> exampleRow() {
        return List.of(
            "Monthly AML/CFT returns review",
            "",
            "Compliance reviews the AML/CFT return before it is filed with the CBN.",
            "Compliance",
            "Detective",
            "Monthly",
            "30",
            "High",
            "Jane Doe",
            "Checks the return for completeness and accuracy before submission",
            "Sample review of the filed return against source data",
            "CBN AML/CFT Regulations 2022 s.12(3)",
            "Anti-Money Laundering",
            "CBN AML/CFT Regulations 2022",
            "12; 345 (IDs from the 'Obligations' sheet)");
    }

    // ------------------------------------------------------------------ validate

    @Override
    public void validate(List<ImportRowData> rows) {
        validateInternal(rows, loadLookups(rows));
    }

    /** Parsed, resolved values of a valid row. */
    private record Parsed(String name, String number, String type, String frequency, Integer frequencyDays,
                          String risk, Owner owner, List<Long> obligationIds) {}

    private record Lookups(Map<String, Owner> owners, Set<Long> liveObligationIds,
                           Set<String> existingNumbers, Set<String> existingNameActKeys, List<Control> existing) {}

    private Lookups loadLookups(List<ImportRowData> rows) {
        Map<String, Owner> owners = new HashMap<>();
        ownerRepo.findByIsActiveTrueOrderByFullNameAsc().forEach(o -> {
            if (o.getFullName() != null) owners.putIfAbsent(norm(o.getFullName()), o);
        });

        Set<Long> requested = new HashSet<>();
        for (ImportRowData row : rows) requested.addAll(parseIds(row.value(LINKED_OBLIGATIONS)).ids());
        Set<Long> live = requested.isEmpty() ? Set.of() : obligationRepo.findAllById(requested).stream()
            .filter(o -> !"deleted".equals(o.getStatus()))
            .map(Obligation::getObligationId)
            .collect(Collectors.toSet());

        List<Control> existing = controlRepo.findAll();
        Set<String> numbers = existing.stream().map(Control::getControlNumber).filter(Objects::nonNull)
            .map(ImportParsing::norm).collect(Collectors.toSet());
        Set<String> nameAct = existing.stream().map(c -> nameActKey(c.getName(), c.getActName()))
            .collect(Collectors.toSet());
        return new Lookups(owners, live, numbers, nameAct, existing);
    }

    private Map<ImportRowData, Parsed> validateInternal(List<ImportRowData> rows, Lookups lk) {
        Map<ImportRowData, Parsed> parsedRows = new IdentityHashMap<>();
        Map<String, Integer> numbersInFile = new HashMap<>();
        Map<String, Integer> nameActInFile = new HashMap<>();
        for (ImportRowData row : rows) {
            List<String> errors = new ArrayList<>();

            String name = row.value(NAME);
            if (name == null) errors.add("Control Name is required");

            MAX_LENGTH.forEach((col, max) -> {
                String v = row.value(col);
                if (v != null && v.length() > max)
                    errors.add(COLUMNS.get(col).header() + " is longer than " + max + " characters");
            });

            String type = strict(row.value(CONTROL_TYPE), TYPE_ALIASES, "Control Type", CONTROL_TYPES, "", errors);
            String frequency = strict(row.value(FREQUENCY), FREQUENCY_ALIASES, "Test Frequency", FREQUENCIES, "", errors);
            String risk = strict(row.value(INHERENT_RISK), RISK_ALIASES, "Inherent Risk", RISK_LEVELS, " (or Medium)", errors);

            Integer frequencyDays = null;
            String daysRaw = row.value(FREQUENCY_DAYS);
            if (daysRaw != null) {
                frequencyDays = parsePositiveInt(daysRaw);
                if (frequencyDays == null)
                    errors.add("Test Frequency Days '" + daysRaw + "' must be a positive whole number");
            } else if (frequency != null) {
                frequencyDays = FREQUENCY_DAYS_DEFAULT.get(frequency);
            }

            Owner owner = null;
            String ownerRaw = row.value(OWNER);
            if (ownerRaw != null) {
                owner = lk.owners().get(norm(ownerRaw));
                if (owner == null) errors.add("Owner '" + ownerRaw + "' does not match an active owner's full name");
            }

            ParsedIds ids = parseIds(row.value(LINKED_OBLIGATIONS));
            if (!ids.badTokens().isEmpty())
                errors.add("Linked Obligation IDs contains values that are not whole numbers: "
                    + String.join(", ", ids.badTokens()) + " (separate IDs with ';' or ',')");
            List<Long> unknown = ids.ids().stream().filter(id -> !lk.liveObligationIds().contains(id)).toList();
            if (!unknown.isEmpty())
                errors.add("Linked Obligation IDs not found in the register (or deleted): "
                    + unknown.stream().map(String::valueOf).collect(Collectors.joining(", ")));

            String number = row.value(NUMBER);

            // display summary — filled for every row so invalid rows are still recognisable
            row.setPrimary(name);
            String typeLabel = type != null ? type : row.value(CONTROL_TYPE);
            row.setSecondary(joinContext(number != null ? number : "Number assigned on import", typeLabel));
            int linkCount = ids.ids().size();
            row.setContext(joinContext(row.value(THEME),
                frequency != null ? frequency : row.value(FREQUENCY),
                linkCount > 0 ? linkCount + " linked obligation" + (linkCount == 1 ? "" : "s") : null));
            row.setRisk(risk);
            row.setCreatedId(null);

            if (!errors.isEmpty()) {
                row.setResult(ImportRowData.INVALID);
                row.setErrors(errors);
                continue;
            }

            String duplicate = null;
            if (number != null) {
                String key = norm(number);
                Integer earlier = numbersInFile.get(key);
                if (lk.existingNumbers().contains(key))
                    duplicate = "Duplicate of a control already in the register (same control number " + number + ")";
                else if (earlier != null)
                    duplicate = "Duplicate of row " + earlier + " in this file (same control number " + number + ")";
                else numbersInFile.put(key, row.getRowNumber());
            } else {
                String key = nameActKey(name, row.value(ACT));
                Integer earlier = nameActInFile.get(key);
                if (lk.existingNameActKeys().contains(key))
                    duplicate = "Duplicate of a control already in the register: same name and act (no control number given)";
                else if (earlier != null)
                    duplicate = "Duplicate of row " + earlier + " in this file: same name and act (no control number given)";
                else nameActInFile.put(key, row.getRowNumber());
            }
            if (duplicate != null) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of(duplicate)));
                continue;
            }

            row.setResult(ImportRowData.VALID);
            row.setErrors(new ArrayList<>());
            parsedRows.put(row, new Parsed(name, number, type, frequency, frequencyDays, risk, owner, ids.ids()));
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

        // Generated numbers continue after the highest CTL-#### already taken (register or this file).
        int highest = 0;
        for (Control c : lk.existing()) highest = Math.max(highest, generatedNumber(c.getControlNumber()));
        for (ImportRowData row : toImport) highest = Math.max(highest, generatedNumber(parsedRows.get(row).number()));
        int next = highest + 1;

        List<Control> controls = new ArrayList<>(toImport.size());
        for (ImportRowData row : toImport) {
            Parsed p = parsedRows.get(row);
            String number = p.number() != null ? p.number() : String.format("CTL-%04d", next++);
            controls.add(Control.builder()
                .controlNumber(number)
                .name(p.name())
                .description(row.value(DESCRIPTION))
                .theme(row.value(THEME))
                .controlType(p.type())
                .whatItDoes(row.value(WHAT_IT_DOES))
                .howTested(row.value(HOW_TESTED))
                .controlOwnerId(p.owner() != null ? p.owner().getOwnerId() : null)
                .controlOwnerName(p.owner() != null ? p.owner().getFullName() : null)
                .testFrequency(p.frequency())
                .testFrequencyDays(p.frequencyDays())
                .linkedObligationIds(new ArrayList<>(p.obligationIds()))
                .inherentRisk(p.risk())
                .residualRisk(p.risk())
                .regulatoryRequirement(row.value(REG_REQUIREMENT))
                .complianceArea(row.value(COMPLIANCE_AREA))
                .actName(row.value(ACT))
                .status("Active")
                .createdByUserId(userId)
                .build());
        }
        List<Control> saved = controlRepo.saveAll(controls);

        // Obligation side of the link: append each new control id to the obligation's classification.
        Map<Long, List<Integer>> controlsByObligation = new LinkedHashMap<>();
        for (int i = 0; i < saved.size(); i++) {
            Integer controlId = saved.get(i).getControlId();
            toImport.get(i).setCreatedId(controlId.longValue());
            for (Long obligationId : parsedRows.get(toImport.get(i)).obligationIds())
                controlsByObligation.computeIfAbsent(obligationId, k -> new ArrayList<>()).add(controlId);
        }
        if (!controlsByObligation.isEmpty()) {
            Map<Long, ObligationClassification> byObligation = classificationRepo
                .findByObligationIdIn(controlsByObligation.keySet()).stream()
                .collect(Collectors.toMap(ObligationClassification::getObligationId, c -> c, (a, b) -> a));
            Map<Long, Obligation> obligations = obligationRepo.findAllById(controlsByObligation.keySet()).stream()
                .collect(Collectors.toMap(Obligation::getObligationId, o -> o));
            Instant now = Instant.now();
            List<ObligationClassification> toSave = new ArrayList<>(controlsByObligation.size());
            controlsByObligation.forEach((obligationId, controlIds) -> {
                ObligationClassification c = byObligation.get(obligationId);
                if (c == null) {
                    Obligation ob = obligations.get(obligationId);
                    c = ObligationClassification.builder()
                        .instrumentId(ob != null ? ob.getInstrumentId() : null)
                        .obligationId(obligationId)
                        .applicability("applicable")
                        .status("active")
                        .classificationVersion(1)
                        .classifiedByUserId(userId)
                        .classifiedAt(now)
                        .build();
                }
                List<Integer> linked = c.getLinkedControlIds() != null
                    ? new ArrayList<>(c.getLinkedControlIds()) : new ArrayList<>();
                for (Integer id : controlIds) if (!linked.contains(id)) linked.add(id);
                c.setLinkedControlIds(linked);
                toSave.add(c);
            });
            classificationRepo.saveAll(toSave);
        }

        List<Integer> ids = saved.stream().map(Control::getControlId).toList();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("entityType", TYPE);
        details.put("count", ids.size());
        details.put("controlIds", ids);
        audit.log(userId, "controls_imported", "import_batch", batchId, details);
        return ids.size();
    }

    @Override
    public void afterCommit() {
        obligationService.evictRegisterCache();
    }

    // ------------------------------------------------------------------ helpers

    private static int generatedNumber(String number) {
        if (number == null) return 0;
        Matcher m = GENERATED_NUMBER.matcher(number.trim());
        if (!m.matches()) return 0;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String nameActKey(String name, String act) {
        return norm(name) + "|" + norm(act);
    }
}
