package com.atheris.compliance.tenant.backend.modules.imports.handler;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.DashboardService;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.imports.handler.ImportParsing.*;

/**
 * Bulk import of findings into the Findings register, in any status with their historical dates.
 * Rows are persisted the way {@code FindingService.manualRaise} does, plus the remediation / CCO sign-off
 * fields a Remediated or Closed finding carries. The dashboard snapshot is recomputed after commit.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FindingImportHandler implements ImportHandler {

    static final String TYPE = "findings";

    // Column indexes — must match COLUMNS order.
    private static final int REFERENCE = 0, DESCRIPTION = 1, FINDING_TYPE = 2, SEVERITY = 3, STATUS = 4,
        DATE_RAISED = 5, DEADLINE = 6, ROOT_CAUSE = 7, CONTROL_NUMBER = 8, OBLIGATION_ID = 9, OWNER = 10,
        REMEDIATION_NOTES = 11, DATE_REMEDIATED = 12, DATE_CLOSED = 13;

    private static final List<ImportColumn> COLUMNS = List.of(
        new ImportColumn("Reference", false, true),
        new ImportColumn("Description", true),
        new ImportColumn("Finding Type", true),
        new ImportColumn("Severity", true),
        new ImportColumn("Status", true),
        new ImportColumn("Date Raised", false),
        new ImportColumn("Remediation Deadline", false),
        new ImportColumn("Root Cause", false),
        new ImportColumn("Linked Control Number", false, true),
        new ImportColumn("Linked Obligation ID", false, true),
        new ImportColumn("Owner", false),
        new ImportColumn("Remediation Notes", false),
        new ImportColumn("Date Remediated", false),
        new ImportColumn("Date Closed", false));

    /** findings.external_reference is VARCHAR(100). */
    private static final int REFERENCE_MAX = 100;
    private static final int PREVIEW_DESCRIPTION_MAX = 120;

    static final String OPEN = "Open", IN_REMEDIATION = "In Remediation", REMEDIATED = "Remediated", CLOSED = "Closed";
    static final List<String> FINDING_TYPES = List.of("Gap", "Control Failure", "Process Weakness");
    static final List<String> SEVERITIES = List.of("Critical", "High", "Medium", "Low");
    static final List<String> STATUSES = List.of(OPEN, IN_REMEDIATION, REMEDIATED, CLOSED);

    private static final Map<String, String> TYPE_ALIASES = buildAliases(FINDING_TYPES, Map.of());
    private static final Map<String, String> SEVERITY_ALIASES = buildAliases(SEVERITIES, Map.of("moderate", "Medium"));
    private static final Map<String, String> STATUS_ALIASES = buildAliases(STATUSES, Map.of());

    private final FindingRepository findingRepo;
    private final ControlRepository controlRepo;
    private final ObligationRepository obligationRepo;
    private final OwnerRepository ownerRepo;
    private final ObligationService obligationService;
    private final DashboardService dashboardService;
    private final AuditService audit;

    // ------------------------------------------------------------------ template

    @Override public String entityType() { return TYPE; }

    @Override public String sheetName() { return "Findings"; }

    @Override public List<ImportColumn> columns() { return COLUMNS; }

    /** Closed rows carry a CCO sign-off, and closing a finding is CCO / TENANT_ADMIN only. */
    @Override public Set<String> requiredRoles() { return Set.of("CCO", "TENANT_ADMIN"); }

    @Override
    public LinkedHashMap<String, List<String>> allowedValues() {
        LinkedHashMap<String, List<String>> m = new LinkedHashMap<>();
        m.put("Finding Type", FINDING_TYPES);
        m.put("Severity", SEVERITIES);
        m.put("Status", STATUSES);
        m.put("Owner", ownerRepo.findByIsActiveTrueOrderByFullNameAsc().stream()
            .map(Owner::getFullName).filter(Objects::nonNull).distinct().toList());
        return m;
    }

    @Override
    public List<ReferenceSheet> referenceSheets() {
        return List.of(obligationsReferenceSheet(obligationService), controlsReferenceSheet(controlRepo));
    }

    @Override
    public List<String> exampleRow() {
        return List.of(
            "IA-2026-014",
            "Sanctions screening was not performed on 12 new customers onboarded in June.",
            "Control Failure",
            "High",
            "Remediated",
            "2026-07-01",
            "",
            "Screening step skipped when the vendor API timed out",
            "CTL-0001 (from the 'Controls' sheet)",
            "12 (ID from the 'Obligations' sheet)",
            "Jane Doe",
            "Customers re-screened; timeout now blocks onboarding",
            "2026-07-20",
            "");
    }

    // ------------------------------------------------------------------ validate

    @Override
    public void validate(List<ImportRowData> rows) {
        validateInternal(rows, loadLookups(rows));
    }

    /** Parsed, resolved values of a valid row. */
    private record Parsed(String reference, String description, String type, String severity, String status,
                          LocalDate raised, LocalDate deadline, Control control, Long obligationId, Owner owner,
                          LocalDate remediated, LocalDate closed) {}

    private record Lookups(Map<String, Owner> owners, Map<String, Control> controlsByNumber,
                           Set<Long> liveObligationIds, Set<String> existingReferences, Set<String> existingKeys) {}

    private Lookups loadLookups(List<ImportRowData> rows) {
        Map<String, Owner> owners = new HashMap<>();
        ownerRepo.findByIsActiveTrueOrderByFullNameAsc().forEach(o -> {
            if (o.getFullName() != null) owners.putIfAbsent(norm(o.getFullName()), o);
        });

        Map<String, Control> controls = new HashMap<>();
        controlRepo.findAll().forEach(c -> {
            if (c.getControlNumber() != null && !c.getControlNumber().isBlank())
                controls.putIfAbsent(norm(c.getControlNumber()), c);
        });

        Set<Long> requested = new HashSet<>();
        for (ImportRowData row : rows) requested.addAll(parseIds(row.value(OBLIGATION_ID)).ids());
        Set<Long> live = requested.isEmpty() ? Set.of() : obligationRepo.findAllById(requested).stream()
            .filter(o -> !"deleted".equals(o.getStatus()))
            .map(Obligation::getObligationId)
            .collect(Collectors.toSet());

        // Seed-sized register: dedup in memory.
        Set<String> references = new HashSet<>();
        Set<String> keys = new HashSet<>();
        for (Finding f : findingRepo.findAll()) {
            if (f.getExternalReference() != null) references.add(norm(f.getExternalReference()));
            keys.add(dedupKey(f.getDescription(), f.getLinkedControlId(), f.getLinkedObligationId()));
        }
        return new Lookups(owners, controls, live, references, keys);
    }

    private Map<ImportRowData, Parsed> validateInternal(List<ImportRowData> rows, Lookups lk) {
        Map<ImportRowData, Parsed> parsedRows = new IdentityHashMap<>();
        Map<String, Integer> referencesInFile = new HashMap<>();
        Map<String, Integer> keysInFile = new HashMap<>();
        LocalDate today = LocalDate.now();
        for (ImportRowData row : rows) {
            List<String> errors = new ArrayList<>();

            String reference = row.value(REFERENCE);
            if (reference != null && reference.length() > REFERENCE_MAX)
                errors.add("Reference is longer than " + REFERENCE_MAX + " characters");

            String description = row.value(DESCRIPTION);
            if (description == null) errors.add("Description is required");

            String typeRaw = row.value(FINDING_TYPE);
            String severityRaw = row.value(SEVERITY);
            String statusRaw = row.value(STATUS);
            if (typeRaw == null) errors.add("Finding Type is required");
            if (severityRaw == null) errors.add("Severity is required");
            if (statusRaw == null) errors.add("Status is required");
            String type = strict(typeRaw, TYPE_ALIASES, "Finding Type", FINDING_TYPES, "", errors);
            String severity = strict(severityRaw, SEVERITY_ALIASES, "Severity", SEVERITIES, " (or Moderate)", errors);
            String status = strict(statusRaw, STATUS_ALIASES, "Status", STATUSES, "", errors);

            // dates — each must parse and not be in the future
            LocalDate raised = date(row, DATE_RAISED, today, errors);
            boolean raisedOk = row.value(DATE_RAISED) == null || raised != null;
            if (raised == null && raisedOk) raised = today;
            LocalDate remediated = date(row, DATE_REMEDIATED, today, errors);
            LocalDate closed = date(row, DATE_CLOSED, today, errors);

            LocalDate deadline = null;
            String deadlineRaw = row.value(DEADLINE);
            if (deadlineRaw != null) {
                deadline = parseDate(deadlineRaw);
                if (deadline == null)
                    errors.add("Remediation Deadline '" + deadlineRaw + "' is not a valid date (use yyyy-MM-dd or dd/MM/yyyy)");
                else if (raised != null && deadline.isBefore(raised))
                    errors.add("Remediation Deadline " + deadline + " is before Date Raised " + raised);
            } else if (raised != null && severity != null) {
                deadline = raised.plusDays(FindingService.slaDays(severity));
            }

            Owner owner = null;
            String ownerRaw = row.value(OWNER);
            if (ownerRaw != null) {
                owner = lk.owners().get(norm(ownerRaw));
                if (owner == null) errors.add("Owner '" + ownerRaw + "' does not match an active owner's full name");
            }

            // status consistency
            if (status != null) {
                boolean needsOwner = !OPEN.equals(status);
                boolean needsRemediated = REMEDIATED.equals(status) || CLOSED.equals(status);
                boolean needsClosed = CLOSED.equals(status);
                if (needsOwner && ownerRaw == null) errors.add("Owner is required when Status is " + status);
                if (needsRemediated && row.value(DATE_REMEDIATED) == null)
                    errors.add("Date Remediated is required when Status is " + status);
                if (!needsRemediated && row.value(DATE_REMEDIATED) != null)
                    errors.add("Date Remediated is only allowed when Status is Remediated or Closed");
                if (needsClosed && row.value(DATE_CLOSED) == null)
                    errors.add("Date Closed is required when Status is Closed");
                if (!needsClosed && row.value(DATE_CLOSED) != null)
                    errors.add("Date Closed is only allowed when Status is Closed");
            }
            if (raised != null && remediated != null && remediated.isBefore(raised))
                errors.add("Date Remediated " + remediated + " is before Date Raised " + raised);
            if (remediated != null && closed != null && closed.isBefore(remediated))
                errors.add("Date Closed " + closed + " is before Date Remediated " + remediated);
            if (raised != null && closed != null && remediated == null && closed.isBefore(raised))
                errors.add("Date Closed " + closed + " is before Date Raised " + raised);

            // links
            Control control = null;
            String controlRaw = row.value(CONTROL_NUMBER);
            if (controlRaw != null) {
                control = lk.controlsByNumber().get(norm(controlRaw));
                if (control == null)
                    errors.add("Linked Control Number '" + controlRaw + "' does not match any control in the register");
            }

            Long obligationId = null;
            String obligationRaw = row.value(OBLIGATION_ID);
            if (obligationRaw != null) {
                ParsedIds ids = parseIds(obligationRaw);
                if (!ids.badTokens().isEmpty() || ids.ids().size() != 1) {
                    errors.add("Linked Obligation ID '" + obligationRaw + "' must be a single whole-number ID");
                } else {
                    obligationId = ids.ids().get(0);
                    if (!lk.liveObligationIds().contains(obligationId))
                        errors.add("Linked Obligation ID " + obligationId + " not found in the register (or deleted)");
                }
            }

            // display summary — filled for every row so invalid rows are still recognisable
            String shortDescription = truncate(description);
            row.setPrimary(reference != null
                ? (shortDescription != null ? reference + " — " + shortDescription : reference)
                : shortDescription);
            row.setSecondary(joinContext(type != null ? type : typeRaw, status != null ? status : statusRaw));
            row.setContext(joinContext(control != null ? control.getControlNumber() : controlRaw,
                obligationRaw != null ? "Obligation " + (obligationId != null ? obligationId : obligationRaw) : null));
            row.setRisk(severity == null ? null : "Medium".equals(severity) ? "Moderate" : severity);
            row.setCreatedId(null);

            if (!errors.isEmpty()) {
                row.setResult(ImportRowData.INVALID);
                row.setErrors(errors);
                continue;
            }

            String duplicate = null;
            if (reference != null) {
                String key = norm(reference);
                Integer earlier = referencesInFile.get(key);
                if (lk.existingReferences().contains(key))
                    duplicate = "Duplicate of a finding already in the register (same reference " + reference + ")";
                else if (earlier != null)
                    duplicate = "Duplicate of row " + earlier + " in this file (same reference " + reference + ")";
                else referencesInFile.put(key, row.getRowNumber());
            } else {
                String key = dedupKey(description, control != null ? control.getControlId() : null, obligationId);
                Integer earlier = keysInFile.get(key);
                if (lk.existingKeys().contains(key))
                    duplicate = "Duplicate of a finding already in the register: same description, control and obligation (no reference given)";
                else if (earlier != null)
                    duplicate = "Duplicate of row " + earlier + " in this file: same description, control and obligation (no reference given)";
                else keysInFile.put(key, row.getRowNumber());
            }
            if (duplicate != null) {
                row.setResult(ImportRowData.DUPLICATE);
                row.setErrors(new ArrayList<>(List.of(duplicate)));
                continue;
            }

            row.setResult(ImportRowData.VALID);
            row.setErrors(new ArrayList<>());
            parsedRows.put(row, new Parsed(reference, description, type, severity, status, raised, deadline,
                control, obligationId, owner, remediated, closed));
        }
        return parsedRows;
    }

    // ------------------------------------------------------------------ persist

    @Override
    public int persist(List<ImportRowData> rows, Integer userId, Long batchId) {
        Map<ImportRowData, Parsed> parsedRows = validateInternal(rows, loadLookups(rows));
        List<ImportRowData> toImport = rows.stream().filter(parsedRows::containsKey).toList();
        if (toImport.isEmpty()) return 0;

        List<Finding> toSave = new ArrayList<>(toImport.size());
        for (ImportRowData row : toImport) {
            Parsed p = parsedRows.get(row);
            Instant raisedAt = startOfDay(p.raised());
            Instant closedAt = startOfDay(p.closed());
            toSave.add(Finding.builder()
                .externalReference(p.reference())
                .triggerReason("Imported")
                .findingType(p.type())
                .severity(p.severity())
                .description(p.description())
                .rootCause(row.value(ROOT_CAUSE))
                .linkedControlId(p.control() != null ? p.control().getControlId() : null)
                .linkedObligationId(p.obligationId())
                .assignedToOwnerId(p.owner() != null ? p.owner().getOwnerId() : null)
                .assignedToName(p.owner() != null ? p.owner().getFullName() : null)
                .assignedAt(p.owner() != null ? raisedAt : null)
                .status(p.status())
                .remediationDeadline(p.deadline())
                .slaDays(FindingService.slaDays(p.severity()))
                .remediationNotes(row.value(REMEDIATION_NOTES))
                .remediationSubmittedAt(startOfDay(p.remediated()))
                .ccoSignOffUserId(closedAt != null ? userId : null)
                .ccoSignOffAt(closedAt)
                .closedAt(closedAt)
                .createdByUserId(userId)
                .createdAt(raisedAt)
                .build());
        }
        List<Finding> saved = findingRepo.saveAll(toSave);

        for (int i = 0; i < saved.size(); i++) toImport.get(i).setCreatedId(saved.get(i).getFindingId());

        List<Long> ids = saved.stream().map(Finding::getFindingId).toList();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("entityType", TYPE);
        details.put("count", ids.size());
        details.put("findingIds", ids);
        audit.log(userId, "findings_imported", "import_batch", batchId, details);
        return ids.size();
    }

    /** Refreshes the dashboard KPIs now rather than at the 2am cron. Never fails the (already committed) import. */
    @Override
    public void afterCommit() {
        try {
            dashboardService.recomputeInNewTransaction();
        } catch (Throwable t) {
            log.warn("Dashboard snapshot refresh after findings import failed: {}", t.getMessage());
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Parses an optional date column; adds an error when unparseable or in the future. */
    private static LocalDate date(ImportRowData row, int col, LocalDate today, List<String> errors) {
        String raw = row.value(col);
        if (raw == null) return null;
        String header = COLUMNS.get(col).header();
        LocalDate d = parseDate(raw);
        if (d == null) {
            errors.add(header + " '" + raw + "' is not a valid date (use yyyy-MM-dd or dd/MM/yyyy)");
            return null;
        }
        if (d.isAfter(today)) {
            errors.add(header + " " + d + " is in the future");
            return null;
        }
        return d;
    }

    private static Instant startOfDay(LocalDate d) {
        return d == null ? null : d.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= PREVIEW_DESCRIPTION_MAX ? s : s.substring(0, PREVIEW_DESCRIPTION_MAX - 1) + "…";
    }

    private static String dedupKey(String description, Integer controlId, Long obligationId) {
        return norm(description) + "|" + controlId + "|" + obligationId;
    }
}
