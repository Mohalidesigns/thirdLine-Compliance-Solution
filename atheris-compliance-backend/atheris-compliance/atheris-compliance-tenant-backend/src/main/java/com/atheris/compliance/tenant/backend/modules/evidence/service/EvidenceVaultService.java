package com.atheris.compliance.tenant.backend.modules.evidence.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.modules.evidence.dto.EvidenceRegisterItem;
import com.atheris.compliance.tenant.backend.modules.evidence.dto.EvidenceStats;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class EvidenceVaultService {

    private final EvidenceFileRepository repo;
    private final FileStorageService storage;
    private final ControlRepository controls;
    private final ControlTestResultRepository controlTests;
    private final FindingRepository findings;
    private final ReturnFilingInstanceRepository returnInstances;
    private final RegulatoryReturnRepository returns;
    private final ObligationRepository obligations;
    private final ObligationClassificationRepository obligationClassifications;
    private final UserRepository users;
    private final OwnerRepository owners;

    /** Source types a user may link an upload to from the Evidence Vault / obligation detail. */
    public static final java.util.Set<String> USER_SOURCE_TYPES =
        java.util.Set.of("control", "control_test", "finding", "return_instance", "return_receipt", "obligation");

    /** Evidence category (Vault chip) for a stored source type. */
    public static String categoryOf(String sourceType) {
        if (sourceType == null) return "other";
        return switch (sourceType) {
            case "control_test" -> "control_tests";
            case "finding" -> "findings";
            case "return_instance", "return_event", "return_receipt" -> "returns";
            case "obligation" -> "obligations";
            case "control" -> "controls";
            case "RUNBOOK_STEP" -> "runbooks";
            default -> "other";
        };
    }

    private static final Map<String, List<String>> TYPES_BY_CATEGORY = Map.of(
        "control_tests", List.of("control_test"),
        "findings", List.of("finding"),
        "returns", List.of("return_instance", "return_event", "return_receipt"),
        "obligations", List.of("obligation"),
        "controls", List.of("control"),
        "runbooks", List.of("RUNBOOK_STEP"));

    public Page<EvidenceRegisterItem> register(String category, String q, Pageable p) {
        Page<EvidenceFile> page = category == null || category.isBlank()
            ? repo.findAllByOrderByCreatedAtDesc(p)
            : repo.findBySourceTypeInOrderByCreatedAtDesc(TYPES_BY_CATEGORY.getOrDefault(category, List.of("#none")), p);
        List<EvidenceRegisterItem> items = toItems(page.getContent());
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            items = items.stream().filter(i ->
                contains(i.getOriginalName(), needle) || contains(i.getDescription(), needle)
                    || contains(i.getLinkedLabel(), needle) || contains(i.getUploadedByName(), needle)).toList();
        }
        return new PageImpl<>(items, p, page.getTotalElements());
    }

    public EvidenceStats stats() {
        Map<String, Long> by = new LinkedHashMap<>();
        for (EvidenceFile f : repo.findAll()) {
            by.merge(categoryOf(f.getSourceType()), 1L, Long::sum);
        }
        return EvidenceStats.builder().total(repo.count()).byCategory(by).build();
    }

    public List<EvidenceRegisterItem> forObligation(Long obligationId) {
        Set<Integer> controlIds = new LinkedHashSet<>();
        obligationClassifications.findByObligationId(obligationId)
            .map(com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification::getLinkedControlIds)
            .orElse(List.of())
            .forEach(controlIds::add);

        List<Long> testIds = controlIds.isEmpty() ? List.of()
            : controlTests.findByControlIdInOrderByTestDateDesc(controlIds).stream()
                .map(ControlTestResult::getTestId).toList();
        List<Long> findingIds = findings.findByLinkedObligationIdIn(List.of(obligationId)).stream()
            .map(Finding::getFindingId).toList();
        List<Long> returnIds = obligations.findLinkedReturnIds(obligationId);
        List<Long> instanceIds = returnIds.isEmpty() ? List.of()
            : returnInstances.findByReturnIdIn(returnIds).stream().map(ReturnFilingInstance::getInstanceId).toList();

        List<EvidenceFile> files = new ArrayList<>();
        files.addAll(repo.findBySourceTypeAndSourceId("obligation", obligationId));
        if (!testIds.isEmpty()) files.addAll(repo.findBySourceTypeInAndSourceIdIn(List.of("control_test"), testIds));
        if (!findingIds.isEmpty()) files.addAll(repo.findBySourceTypeInAndSourceIdIn(List.of("finding"), findingIds));
        if (!instanceIds.isEmpty())
            files.addAll(repo.findBySourceTypeInAndSourceIdIn(List.of("return_instance", "return_receipt"), instanceIds));
        if (!returnIds.isEmpty())
            files.addAll(repo.findBySourceTypeInAndSourceIdIn(List.of("return_event"), returnIds));
        files.sort(Comparator.comparing(EvidenceFile::getCreatedAt,
            Comparator.nullsLast(Comparator.reverseOrder())));
        return toItems(files);
    }

    private List<EvidenceRegisterItem> toItems(List<EvidenceFile> files) {
        if (files.isEmpty()) return List.of();
        Map<Integer, String> userNames = users.findAllById(files.stream()
                .map(EvidenceFile::getUploadedByUserId).filter(Objects::nonNull).distinct().toList()).stream()
            .collect(Collectors.toMap(u -> u.getUserId(), u -> blank(u.getFullName())));

        Set<Long> testIds = new HashSet<>();
        Set<Long> findingIds = new HashSet<>();
        Set<Long> instanceIds = new HashSet<>();
        Set<Long> returnEventIds = new HashSet<>();
        Set<Integer> controlIds = new HashSet<>();
        Set<Long> obligationIds = new HashSet<>();
        for (EvidenceFile f : files) {
            if (f.getSourceId() == null) continue;
            switch (f.getSourceType() == null ? "" : f.getSourceType()) {
                case "control_test" -> testIds.add(f.getSourceId());
                case "finding" -> findingIds.add(f.getSourceId());
                case "return_instance", "return_receipt" -> instanceIds.add(f.getSourceId());
                case "return_event" -> returnEventIds.add(f.getSourceId());
                case "control" -> { if (f.getSourceId() <= Integer.MAX_VALUE) controlIds.add(f.getSourceId().intValue()); }
                case "obligation" -> obligationIds.add(f.getSourceId());
                default -> { }
            }
        }

        Map<Long, ControlTestResult> testsById = testIds.isEmpty() ? Map.of()
            : controlTests.findAllById(testIds).stream().collect(Collectors.toMap(ControlTestResult::getTestId, t -> t));
        testsById.values().forEach(t -> controlIds.add(t.getControlId()));
        Map<Integer, Control> controlsById = controlIds.isEmpty() ? Map.of()
            : controls.findAllById(controlIds).stream().collect(Collectors.toMap(Control::getControlId, c -> c));
        Map<Long, Finding> findingsById = findingIds.isEmpty() ? Map.of()
            : findings.findAllById(findingIds).stream().collect(Collectors.toMap(Finding::getFindingId, f -> f));
        Map<Long, ReturnFilingInstance> instancesById = instanceIds.isEmpty() ? Map.of()
            : returnInstances.findAllById(instanceIds).stream().collect(Collectors.toMap(ReturnFilingInstance::getInstanceId, i -> i));
        Set<Long> returnIds = new LinkedHashSet<>(returnEventIds);
        instancesById.values().forEach(i -> returnIds.add(i.getReturnId()));
        Map<Long, RegulatoryReturn> returnsById = returnIds.isEmpty() ? Map.of()
            : returns.findAllById(returnIds).stream().collect(Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));
        Map<Long, Obligation> obligationsById = obligationIds.isEmpty() ? Map.of()
            : obligations.findAllById(obligationIds).stream().collect(Collectors.toMap(Obligation::getObligationId, o -> o));

        List<EvidenceRegisterItem> out = new ArrayList<>();
        for (EvidenceFile f : files) {
            LinkedRef ref = resolve(f, controlsById, testsById, findingsById, instancesById, returnsById, obligationsById);
            out.add(EvidenceRegisterItem.builder()
                .fileId(f.getFileId()).originalName(f.getOriginalName()).mimeType(f.getMimeType())
                .fileSize(f.getFileSize()).sourceType(f.getSourceType()).sourceId(f.getSourceId())
                .category(categoryOf(f.getSourceType())).description(f.getDescription())
                .uploadedByName(f.getUploadedByUserId() == null ? null : userNames.get(f.getUploadedByUserId()))
                .createdAt(f.getCreatedAt())
                .linkedLabel(ref.label()).linkedPath(ref.path())
                .build());
        }
        return out;
    }

    private record LinkedRef(String label, String path) {}

    private LinkedRef resolve(EvidenceFile f, Map<Integer, Control> controlsById, Map<Long, ControlTestResult> testsById,
                              Map<Long, Finding> findingsById, Map<Long, ReturnFilingInstance> instancesById,
                              Map<Long, RegulatoryReturn> returnsById, Map<Long, Obligation> obligationsById) {
        String type = f.getSourceType() == null ? "" : f.getSourceType();
        Long id = f.getSourceId();
        if (id == null) return new LinkedRef(null, null);
        switch (type) {
            case "control_test" -> {
                ControlTestResult t = testsById.get(id);
                Control c = t == null ? null : controlsById.get(t.getControlId());
                if (c != null) return new LinkedRef("Control test · " + blank(c.getControlNumber()) + " " + blank(c.getName()),
                    "/controls?controlId=" + c.getControlId());
                return new LinkedRef("Control test", "/controls");
            }
            case "finding" -> {
                Finding fd = findingsById.get(id);
                if (fd != null) return new LinkedRef("Finding · FIND-" + String.format("%03d", fd.getFindingId()),
                    "/findings?findingId=" + fd.getFindingId());
                return new LinkedRef("Finding", "/findings");
            }
            case "return_instance", "return_receipt" -> {
                ReturnFilingInstance inst = instancesById.get(id);
                RegulatoryReturn r = inst == null ? null : returnsById.get(inst.getReturnId());
                if (r != null) {
                    String suffix = "return_receipt".equals(type) ? " · filing receipt" : "";
                    return new LinkedRef(blank(r.getReturnName()) + (inst.getPeriod() != null ? " · " + inst.getPeriod() : "") + suffix,
                        "/returns/" + r.getReturnId() + "?instanceId=" + inst.getInstanceId());
                }
                return new LinkedRef("Return filing" + ("return_receipt".equals(type) ? " · receipt" : ""), "/returns");
            }
            case "return_event" -> {
                RegulatoryReturn r = returnsById.get(id);
                return new LinkedRef(r == null ? "Return event" : blank(r.getReturnName()) + " · event filing",
                    r == null ? "/returns" : "/returns/" + r.getReturnId());
            }
            case "control" -> {
                Control c = controlsById.get(id.intValue());
                if (c != null) return new LinkedRef("Control · " + blank(c.getControlNumber()) + " " + blank(c.getName()),
                    "/controls?controlId=" + c.getControlId());
                return new LinkedRef("Control", "/controls");
            }
            case "obligation" -> {
                Obligation o = obligationsById.get(id);
                return new LinkedRef(o == null ? "Obligation" : blank(o.getName()), "/obligations/" + id);
            }
            case "RUNBOOK_STEP" -> {
                return new LinkedRef(blank(f.getDescription()), "/runbooks");
            }
            default -> { return new LinkedRef(null, null); }
        }
    }

    private static boolean contains(String s, String needle) {
        return s != null && s.toLowerCase().contains(needle);
    }

    private static String blank(String s) {
        return s == null ? "" : s;
    }

    public Page<EvidenceFile> list(Pageable p) {
        return repo.findAllByOrderByCreatedAtDesc(p);
    }

    public List<EvidenceFile> listBySource(String sourceType, Long sourceId) {
        return repo.findBySourceTypeAndSourceId(sourceType, sourceId);
    }

    public EvidenceFile getFile(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Evidence file not found: " + id));
    }

    public byte[] download(EvidenceFile f) throws java.io.IOException {
        return storage.load(f.getStoragePath());
    }

    /**
     * User-facing upload: the optional link must name a known source type AND an existing record,
     * so evidence can never point at e.g. "control #999999". Internal callers (runbook steps,
     * remediation, return events) pass sources they already resolved and use {@link #upload}.
     */
    @Transactional
    public EvidenceFile uploadLinked(MultipartFile file, String sourceType, Long sourceId, String description,
                                     Integer userId) throws Exception {
        String type = sourceType == null || sourceType.isBlank() ? null : sourceType.trim().toLowerCase(java.util.Locale.ROOT);
        if (type == null && sourceId != null)
            throw ApiException.badRequest("source_type_required", "Choose what the evidence is linked to");
        if (type != null) {
            if (!USER_SOURCE_TYPES.contains(type))
                throw ApiException.badRequest("invalid_source_type", "Unknown source type: " + sourceType);
            if (sourceId == null)
                throw ApiException.badRequest("source_id_required", "Give the id of the " + type.replace('_', ' '));
            if (!sourceExists(type, sourceId))
                throw ApiException.badRequest("source_not_found", "No " + type.replace('_', ' ') + " #" + sourceId + " exists");
        }
        return upload(file, type, sourceId, description, userId);
    }

    private boolean sourceExists(String type, Long id) {
        return switch (type) {
            case "control" -> id <= Integer.MAX_VALUE && controls.existsById(id.intValue());
            case "control_test" -> controlTests.existsById(id);
            case "finding" -> findings.existsById(id);
            case "return_instance" -> returnInstances.existsById(id);
            case "return_receipt" -> returnInstances.existsById(id);
            case "obligation" -> obligations.existsById(id);
            default -> false;
        };
    }

    @Transactional
    public EvidenceFile upload(MultipartFile file, String sourceType, Long sourceId, String description, Integer userId) throws Exception {
        String storagePath = storage.store(file);
        EvidenceFile ef = EvidenceFile.builder()
            .fileName(storagePath.substring(storagePath.lastIndexOf(java.io.File.separator) + 1))
            .originalName(file.getOriginalFilename())
            .mimeType(file.getContentType())
            .fileSize(file.getSize())
            .storagePath(storagePath)
            .sourceType(sourceType).sourceId(sourceId)
            .description(description).uploadedByUserId(userId).build();
        return repo.save(ef);
    }
}
