package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.imports.handler.ImportParsing.*;

/**
 * Bulk import of standalone obligations straight into the Obligations Register
 * ({@code source = "imported"}, no platform instrument, regulator held in {@code tenant_regulator_id}).
 */
@Component
@RequiredArgsConstructor
public class ObligationImportHandler implements ImportHandler {

    static final String TYPE = "obligations";

    // Column indexes — must match COLUMNS order.
    private static final int TITLE = 0, TEXT = 1, PLAIN = 2, REGULATOR = 3, ACT = 4, SECTION = 5,
        AREA = 6, OB_TYPE = 7, DEADLINE = 8, EFFECTIVE = 9, IMPACT = 10, LIKELIHOOD = 11,
        OWNER = 12, HAS_GAP = 13, GAP_DESC = 14;

    private static final List<ImportColumn> COLUMNS = List.of(
        new ImportColumn("Obligation Title", true),
        new ImportColumn("Obligation Text", false),
        new ImportColumn("Plain-English Statement", false),
        new ImportColumn("Regulator", true),
        new ImportColumn("Act / Regulation", false),
        new ImportColumn("Section Reference", false),
        new ImportColumn("Area of Focus", false),
        new ImportColumn("Obligation Type", false),
        new ImportColumn("Deadline Type", false),
        new ImportColumn("Effective Date", false),
        new ImportColumn("Impact", false),
        new ImportColumn("Likelihood", false),
        new ImportColumn("Owner", false),
        new ImportColumn("Has Gap", false),
        new ImportColumn("Gap Description", false));

    /** Column widths of the target VARCHAR columns on {@code obligations}. */
    private static final Map<Integer, Integer> MAX_LENGTH = Map.of(ACT, 500, AREA, 100, OB_TYPE, 100, DEADLINE, 100);

    private static final Map<String, String> IMPACT_ALIASES = buildAliases(ObligationClassification.IMPACT_LEVELS,
        Map.of("low", "Minor", "medium", "Moderate", "high", "Major", "critical", "Severe"));
    private static final Map<String, String> LIKELIHOOD_ALIASES =
        buildAliases(ObligationClassification.LIKELIHOOD_LEVELS, Map.of());

    private static final Set<String> YES = Set.of("y", "yes", "true");
    private static final Set<String> NO = Set.of("n", "no", "false");

    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classificationRepo;
    private final TenantRegulatorRepository regulatorRepo;
    private final OwnerRepository ownerRepo;
    private final DepartmentRepository departmentRepo;
    private final TenantIdentityService tenantIdentity;
    private final ObligationService obligationService;
    private final AuditService audit;

    // ------------------------------------------------------------------ template

    @Override public String entityType() { return TYPE; }

    @Override public String sheetName() { return "Obligations"; }

    @Override public List<ImportColumn> columns() { return COLUMNS; }

    @Override
    public LinkedHashMap<String, List<String>> allowedValues() {
        LinkedHashMap<String, List<String>> m = new LinkedHashMap<>();
        m.put("Regulator", activeRegulators().stream().map(ImportParsing::regulatorLabel).distinct().toList());
        m.put("Impact", ObligationClassification.IMPACT_LEVELS);
        m.put("Likelihood", ObligationClassification.LIKELIHOOD_LEVELS);
        m.put("Owner", ownerRepo.findByIsActiveTrueOrderByFullNameAsc().stream()
            .map(Owner::getFullName).filter(Objects::nonNull).distinct().toList());
        m.put("Has Gap", List.of("Y", "N"));
        return m;
    }

    @Override
    public List<String> exampleRow() {
        return List.of(
            "Submit monthly AML/CFT returns",
            "Every bank shall render to the Bank monthly returns on its AML/CFT compliance ...",
            "Banks must file AML/CFT returns with the CBN every month.",
            "CBN",
            "CBN AML/CFT Regulations 2022",
            "s.12(3)",
            "Anti-Money Laundering",
            "Reporting",
            "Monthly",
            "2026-01-31",
            "Major",
            "Likely",
            "Jane Doe",
            "N",
            "");
    }

    // ------------------------------------------------------------------ validate

    @Override
    public void validate(List<ImportRowData> rows) {
        validateInternal(rows, loadLookups());
    }

    /** Parsed, resolved values of a valid row. */
    private record Parsed(String title, String text, String plain, TenantRegulator regulator, String act,
                          String section, String area, String obligationType, String deadline, LocalDate effective,
                          String impact, String likelihood, Owner owner, boolean hasGap, String gapDescription) {}

    private record Lookups(Map<String, TenantRegulator> regulators, Map<String, Owner> owners,
                           Map<Integer, String> departmentNames, Set<String> existingKeys) {}

    private Lookups loadLookups() {
        Map<String, TenantRegulator> regulators = regulatorLookup(activeRegulators());

        Map<String, Owner> owners = new HashMap<>();
        ownerRepo.findByIsActiveTrueOrderByFullNameAsc().forEach(o -> {
            if (o.getFullName() != null) owners.putIfAbsent(norm(o.getFullName()), o);
        });

        Map<Integer, String> departmentNames = departmentRepo.findAll().stream()
            .filter(d -> d.getName() != null)
            .collect(Collectors.toMap(Department::getDepartmentId, Department::getName, (a, b) -> a));

        Set<String> existingKeys = obligationRepo.findAll().stream()
            .filter(o -> !"deleted".equals(o.getStatus()))
            .map(o -> dedupKey(o.getTitle() != null ? o.getTitle() : o.getName(), o.getSectionReference(), o.getActName()))
            .collect(Collectors.toSet());

        return new Lookups(regulators, owners, departmentNames, existingKeys);
    }

    private List<TenantRegulator> activeRegulators() {
        return ImportParsing.activeRegulators(regulatorRepo, tenantIdentity);
    }

    private Map<ImportRowData, Parsed> validateInternal(List<ImportRowData> rows, Lookups lk) {
        Map<ImportRowData, Parsed> parsedRows = new IdentityHashMap<>();
        Map<String, Integer> seenInFile = new HashMap<>();
        for (ImportRowData row : rows) {
            List<String> errors = new ArrayList<>();

            String title = row.value(TITLE);
            if (title == null) errors.add("Obligation Title is required");

            String regRaw = row.value(REGULATOR);
            TenantRegulator regulator = null;
            if (regRaw == null) {
                errors.add("Regulator is required");
            } else {
                regulator = lk.regulators().get(norm(regRaw));
                if (regulator == null)
                    errors.add("Regulator '" + regRaw + "' does not match any of your active regulators (name or abbreviation)");
            }

            MAX_LENGTH.forEach((col, max) -> {
                String v = row.value(col);
                if (v != null && v.length() > max)
                    errors.add(COLUMNS.get(col).header() + " is longer than " + max + " characters");
            });

            String impact = null;
            String impactRaw = row.value(IMPACT);
            if (impactRaw != null) {
                impact = IMPACT_ALIASES.get(norm(impactRaw));
                if (impact == null) errors.add("Impact '" + impactRaw + "' must be one of "
                    + String.join(", ", ObligationClassification.IMPACT_LEVELS) + " (or Low, Medium, High, Critical)");
            }

            String likelihood = null;
            String likelihoodRaw = row.value(LIKELIHOOD);
            if (likelihoodRaw != null) {
                likelihood = LIKELIHOOD_ALIASES.get(norm(likelihoodRaw));
                if (likelihood == null) errors.add("Likelihood '" + likelihoodRaw + "' must be one of "
                    + String.join(", ", ObligationClassification.LIKELIHOOD_LEVELS));
            }

            Owner owner = null;
            String ownerRaw = row.value(OWNER);
            if (ownerRaw != null) {
                owner = lk.owners().get(norm(ownerRaw));
                if (owner == null) errors.add("Owner '" + ownerRaw + "' does not match an active owner's full name");
            }

            LocalDate effective = null;
            String dateRaw = row.value(EFFECTIVE);
            if (dateRaw != null) {
                effective = parseDate(dateRaw);
                if (effective == null)
                    errors.add("Effective Date '" + dateRaw + "' is not a valid date (use yyyy-MM-dd or dd/MM/yyyy)");
            }

            boolean hasGap = false;
            String gapRaw = row.value(HAS_GAP);
            if (gapRaw != null) {
                String g = norm(gapRaw);
                if (YES.contains(g)) hasGap = true;
                else if (!NO.contains(g)) errors.add("Has Gap '" + gapRaw + "' must be Y or N");
            }

            // display summary — filled for every row so invalid rows are still recognisable
            row.setPrimary(title);
            row.setSecondary(row.value(PLAIN) != null ? row.value(PLAIN) : row.value(TEXT));
            row.setContext(joinContext(regulator != null ? regulatorLabel(regulator) : regRaw,
                row.value(ACT), row.value(SECTION)));
            row.setRisk(ObligationClassification.inherentBand(impact, likelihood));
            row.setCreatedId(null);

            if (!errors.isEmpty()) {
                row.setResult(ImportRowData.INVALID);
                row.setErrors(errors);
                continue;
            }

            String key = dedupKey(title, row.value(SECTION), row.value(ACT));
            if (lk.existingKeys().contains(key)) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of("Duplicate of an obligation already in the register (same title, section and act)")));
                continue;
            }
            Integer earlier = seenInFile.get(key);
            if (earlier != null) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of("Duplicate of row " + earlier + " in this file (same title, section and act)")));
                continue;
            }
            seenInFile.put(key, row.getRowNumber());

            row.setResult(ImportRowData.VALID);
            row.setErrors(new ArrayList<>());
            parsedRows.put(row, new Parsed(title, row.value(TEXT), row.value(PLAIN), regulator, row.value(ACT),
                row.value(SECTION), row.value(AREA), row.value(OB_TYPE), row.value(DEADLINE), effective,
                impact, likelihood, owner, hasGap, hasGap ? row.value(GAP_DESC) : null));
        }
        return parsedRows;
    }

    // ------------------------------------------------------------------ persist

    @Override
    public int persist(List<ImportRowData> rows, Integer userId, Long batchId) {
        Lookups lk = loadLookups();
        Map<ImportRowData, Parsed> parsedRows = validateInternal(rows, lk);
        List<ImportRowData> toImport = rows.stream().filter(parsedRows::containsKey).toList();
        if (toImport.isEmpty()) return 0;

        int nextNumber = obligationRepo.findFirstByObligationNumberNotNullOrderByObligationNumberDesc()
            .map(o -> o.getObligationNumber() + 1).orElse(1);

        List<Obligation> obligations = new ArrayList<>(toImport.size());
        for (ImportRowData row : toImport) {
            Parsed p = parsedRows.get(row);
            obligations.add(Obligation.builder()
                .name(p.title())
                .title(p.title())
                .obligationNumber(nextNumber++)
                .description(p.text())
                .plainEnglishStatement(p.plain())
                .actName(p.act())
                .sectionReference(p.section())
                .areaOfFocus(p.area())
                .obligationType(p.obligationType())
                .recurringDeadlineType(p.deadline())
                .effectiveDate(p.effective())
                .tenantRegulatorId(p.regulator().getId())
                .inherentImpact(p.impact())
                .inherentLikelihood(p.likelihood())
                .inherentRiskRating(ObligationClassification.inherentBand(p.impact(), p.likelihood()))
                .status("active")
                .source("imported")
                .build());
        }
        List<Obligation> saved = obligationRepo.saveAll(obligations);

        Instant now = Instant.now();
        List<ObligationClassification> classifications = new ArrayList<>(saved.size());
        for (int i = 0; i < saved.size(); i++) {
            Obligation ob = saved.get(i);
            Parsed p = parsedRows.get(toImport.get(i));
            ObligationClassification c = ObligationClassification.builder()
                .obligationId(ob.getObligationId())
                .applicability("applicable")
                .status("active")
                .classificationVersion(1)
                .classifiedByUserId(userId)
                .classifiedAt(now)
                .impactRating(p.impact())
                .likelihoodRating(p.likelihood())
                .hasGap(p.hasGap())
                .gapDescription(p.gapDescription())
                .linkedControlIds(new ArrayList<>())
                .build();
            if (p.owner() != null) {
                Owner o = p.owner();
                ObligationService.applyOwner(c, o,
                    o.getDepartmentId() != null ? lk.departmentNames().get(o.getDepartmentId()) : null);
            }
            classifications.add(c);
            toImport.get(i).setCreatedId(ob.getObligationId());
        }
        classificationRepo.saveAll(classifications);

        List<Long> ids = saved.stream().map(Obligation::getObligationId).toList();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("entityType", TYPE);
        details.put("count", ids.size());
        details.put("obligationIds", ids);
        audit.log(userId, "obligations_imported", "import_batch", batchId, details);
        return ids.size();
    }

    @Override
    public void afterCommit() {
        obligationService.evictRegisterCache();
    }

    // ------------------------------------------------------------------ helpers

    static String dedupKey(String title, String section, String act) {
        return norm(title) + "|" + norm(section) + "|" + norm(act);
    }

}
