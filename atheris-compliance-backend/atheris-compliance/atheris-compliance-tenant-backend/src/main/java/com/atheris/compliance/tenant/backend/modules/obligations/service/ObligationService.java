package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.dto.*;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.*;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ObligationService {

    private final ObligationClassificationRepository classifications;
    private final ClassificationHistoryRepository history;
    private final ObligationRepository obligationRepo;
    private final ControlRepository controlRepo;
    private final RegulatoryReturnRepository returnRepo;
    private final EvidenceFileRepository evidenceRepo;
    private final UserRepository userRepo;
    private final AuditService audit;
    private final PlatformApiClient platform;

    private static final List<String> RISK_LEVELS = List.of("Extreme", "High", "Medium", "Low");

    // ------------------------------------------------------------------ register

    public Page<ObligationRegisterItem> getRegisterList(
            String q, String risk, String regulator, String theme, String owner,
            String status, Boolean hasGap, Boolean noControl, Pageable p) {
        List<ObligationRegisterItem> rows = buildRegisterRows();
        List<ObligationRegisterItem> filtered = rows.stream()
            .filter(item -> matches(item, q, risk, regulator, theme, owner, status, hasGap, noControl))
            .sorted(registerComparator(p))
            .toList();
        int total = filtered.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ObligationRegisterItem> page = start >= total ? List.of() : filtered.subList(start, end);
        return new PageImpl<>(page, p, total);
    }

    public ObligationStats getStats() {
        List<ObligationRegisterItem> rows = buildRegisterRows();
        long total = rows.size();
        long highRisk = rows.stream().filter(i ->
                "Extreme".equals(i.getInherentRiskRating()) || "High".equals(i.getInherentRiskRating())
                    || "Extreme".equals(i.getTenantRiskRating()) || "High".equals(i.getTenantRiskRating())).count();
        long gaps = rows.stream().filter(i -> i.getControlCount() == 0).count();
        long underReview = rows.stream().filter(i -> i.getApplicability() == null
                || !i.getApplicability().equals("applicable")
                || "unclassified".equals(i.getStatus())).count();

        Set<String> regulators = rows.stream()
            .map(ObligationRegisterItem::getRegulatorAbbreviation)
            .filter(Objects::nonNull).filter(s -> !s.isBlank())
            .collect(Collectors.toCollection(TreeSet::new));
        Set<String> themes = rows.stream()
            .map(ObligationRegisterItem::getObligationType)
            .filter(Objects::nonNull).filter(s -> !s.isBlank())
            .collect(Collectors.toCollection(TreeSet::new));
        Set<String> owners = rows.stream()
            .map(ObligationRegisterItem::getAssignedOwnerName)
            .filter(Objects::nonNull).filter(s -> !s.isBlank())
            .collect(Collectors.toCollection(TreeSet::new));

        return ObligationStats.builder()
            .total(total).highRisk(highRisk).gaps(gaps).underReview(underReview)
            .regulators(List.copyOf(regulators))
            .themes(List.copyOf(themes))
            .owners(List.copyOf(owners))
            .riskLevels(RISK_LEVELS)
            .build();
    }

    private List<ObligationRegisterItem> buildRegisterRows() {
        List<Obligation> allObligations = obligationRepo.findAll();
        Map<Long, ObligationClassification> classByObligation = classifications.findAll().stream()
            .filter(c -> c.getObligationId() != null)
            .collect(Collectors.toMap(ObligationClassification::getObligationId, c -> c, (a, b) -> a));
        Map<Long, PlatformInstrumentDetail> detailCache = new HashMap<>();
        Map<Long, List<Long>> returnsByObligation = obligationRepo.findAllReturnLinks().stream()
            .collect(Collectors.groupingBy(
                ObligationRepository.ObligationReturnRow::getObligationId,
                Collectors.mapping(ObligationRepository.ObligationReturnRow::getReturnId, Collectors.toList())));
        Set<Long> returnIds = returnsByObligation.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        Map<Long, String> returnNameById = returnRepo.findAllById(returnIds).stream()
            .collect(Collectors.toMap(RegulatoryReturn::getReturnId, RegulatoryReturn::getReturnName, (a, b) -> a));

        List<ObligationRegisterItem> rows = new ArrayList<>();
        for (Obligation ob : allObligations) {
            ObligationClassification c = classByObligation.get(ob.getObligationId());
            PlatformInstrumentDetail d = detailCache.computeIfAbsent(ob.getInstrumentId(), platform::getInstrumentDetail);
            List<Long> linkedReturnIds = returnsByObligation.getOrDefault(ob.getObligationId(), List.of());
            List<String> returnNames = linkedReturnIds.stream()
                .map(id -> returnNameById.get(id)).filter(Objects::nonNull).toList();

            rows.add(ObligationRegisterItem.builder()
                .obligationId(ob.getObligationId())
                .obligationNumber(ob.getObligationNumber())
                .description(ob.getDescription())
                .sectionReference(ob.getSectionReference())
                .obligationType(ob.getObligationType())
                .recurringDeadlineType(ob.getRecurringDeadlineType())
                .effectiveDate(ob.getEffectiveDate())
                .instrumentId(ob.getInstrumentId())
                .sourceTitle(d != null ? d.getSourceTitle() : "Instrument " + ob.getInstrumentId())
                .regulatorAbbreviation(d != null ? d.getRegulatorAbbreviation() : null)
                .regulatorName(d != null ? d.getRegulatorName() : null)
                .applicability(c != null ? c.getApplicability() : null)
                .tenantRiskRating(c != null ? c.getTenantRiskRating() : null)
                .inherentRiskRating(c != null ? c.getInherentRiskRating() : null)
                .residualRiskRating(c != null ? c.getResidualRiskRating() : null)
                .assignedOwnerName(c != null ? c.getAssignedOwnerName() : null)
                .assignedDepartment(c != null ? c.getAssignedDepartment() : null)
                .status(c != null ? c.getStatus() : ob.getStatus())
                .hasGap(c != null && Boolean.TRUE.equals(c.getHasGap()))
                .gapDescription(c != null ? c.getGapDescription() : null)
                .linkedControlIds(c != null ? c.getLinkedControlIds() : null)
                .controlCount(c != null && c.getLinkedControlIds() != null ? c.getLinkedControlIds().size() : 0)
                .linkedReturnIds(linkedReturnIds)
                .returnNames(returnNames)
                .classificationVersion(c != null ? c.getClassificationVersion() : null)
                .classifiedAt(c != null ? c.getClassifiedAt() : null)
                .build());
        }
        return rows;
    }

    private boolean matches(ObligationRegisterItem i, String q, String risk, String regulator,
                            String theme, String owner, String status, Boolean hasGap, Boolean noControl) {
        if (hasGap != null && hasGap && !Boolean.TRUE.equals(i.getHasGap())) return false;
        if (noControl != null && noControl && i.getControlCount() > 0) return false;
        if (risk != null && !risk.isBlank()
                && !risk.equals(i.getTenantRiskRating()) && !risk.equals(i.getInherentRiskRating())) return false;
        if (regulator != null && !regulator.isBlank()) {
            boolean regMatch = regulator.equals(i.getRegulatorAbbreviation()) || regulator.equals(i.getRegulatorName());
            if (!regMatch) return false;
        }
        if (theme != null && !theme.isBlank() && !theme.equals(i.getObligationType())) return false;
        if (owner != null && !owner.isBlank() && !owner.equals(i.getAssignedOwnerName())) return false;
        if (status != null && !status.isBlank() && !status.equals(i.getStatus())) return false;
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            boolean match = contains(i.getDescription(), needle)
                || contains(i.getSourceTitle(), needle)
                || contains(i.getRegulatorAbbreviation(), needle)
                || contains(i.getRegulatorName(), needle);
            if (!match) return false;
        }
        return true;
    }

    private static boolean contains(String s, String needle) {
        return s != null && s.toLowerCase().contains(needle);
    }

    private Comparator<ObligationRegisterItem> registerComparator(Pageable p) {
        Comparator<ObligationRegisterItem> cmp;
        String sort = p.getSort().isSorted()
            ? p.getSort().iterator().next().getProperty() : "description";
        boolean asc = !p.getSort().isSorted() || p.getSort().iterator().next().isAscending();
        cmp = switch (sort) {
            case "obligationNumber" -> Comparator.comparing(
                i -> i.getObligationNumber() != null ? i.getObligationNumber() : Integer.MAX_VALUE);
            case "sourceTitle" -> Comparator.comparing(i -> nullSafe(i.getSourceTitle()));
            case "tenantRiskRating", "inherentRiskRating" -> riskComparator();
            case "assignedOwnerName" -> Comparator.comparing(i -> nullSafe(i.getAssignedOwnerName()));
            case "status" -> Comparator.comparing(i -> nullSafe(i.getStatus()));
            default -> Comparator.comparing(i -> nullSafe(i.getDescription()));
        };
        return asc ? cmp : cmp.reversed();
    }

    private static Comparator<ObligationRegisterItem> riskComparator() {
        Map<String, Integer> order = Map.of("Extreme", 4, "High", 3, "Medium", 2, "Low", 1);
        return Comparator.comparingInt(i -> {
            String key = i.getTenantRiskRating() != null ? i.getTenantRiskRating() : i.getInherentRiskRating();
            return key != null ? order.getOrDefault(key, 0) : 0;
        });
    }

    private static String nullSafe(String s) { return s != null ? s : ""; }

    // ------------------------------------------------------------------ detail

    public ObligationDetailView getObligationDetail(Long obligationId) {
        Obligation ob = obligationRepo.findById(obligationId)
            .orElseThrow(() -> new RuntimeException("Obligation not found: " + obligationId));
        ObligationClassification c = classifications.findByObligationId(obligationId).orElse(null);
        PlatformInstrumentDetail d = platform.getInstrumentDetail(ob.getInstrumentId());

        List<ObligationDetailView.ControlItem> controls = Collections.emptyList();
        if (c != null && c.getLinkedControlIds() != null && !c.getLinkedControlIds().isEmpty()) {
            Map<Integer, Control> byId = controlRepo.findAllById(c.getLinkedControlIds()).stream()
                .collect(Collectors.toMap(Control::getControlId, x -> x, (a, b) -> a));
            controls = c.getLinkedControlIds().stream()
                .map(byId::get).filter(Objects::nonNull)
                .map(ct -> ObligationDetailView.ControlItem.builder()
                    .controlId(ct.getControlId()).controlNumber(ct.getControlNumber())
                    .name(ct.getName()).theme(ct.getTheme()).controlType(ct.getControlType())
                    .inherentRisk(ct.getInherentRisk()).residualRisk(ct.getResidualRisk())
                    .controlOwnerName(ct.getControlOwnerName()).status(ct.getStatus()).build())
                .toList();
        }

        List<Long> returnIds = obligationRepo.findLinkedReturnIds(obligationId);
        List<ObligationDetailView.ReturnItem> returns = returnRepo.findAllById(returnIds).stream()
            .map(r -> ObligationDetailView.ReturnItem.builder()
                .returnId(r.getReturnId()).returnName(r.getReturnName())
                .frequency(r.getFrequency()).filingRegulator(r.getFilingRegulator()).build())
            .toList();

        List<EvidenceFile> evidenceFiles = evidenceRepo.findBySourceTypeAndSourceId("obligation", obligationId);
        Map<Integer, String> userNameById = userRepo.findByIsActiveTrue().stream()
            .collect(Collectors.toMap(User::getUserId, User::getFullName, (a, b) -> a));
        List<ObligationDetailView.EvidenceItem> evidence = evidenceFiles.stream()
            .map(ef -> ObligationDetailView.EvidenceItem.builder()
                .fileId(ef.getFileId()).originalName(ef.getOriginalName())
                .mimeType(ef.getMimeType()).fileSize(ef.getFileSize())
                .description(ef.getDescription())
                .uploadedByUserId(ef.getUploadedByUserId())
                .uploadedByName(ef.getUploadedByUserId() != null ? userNameById.get(ef.getUploadedByUserId()) : null)
                .createdAt(ef.getCreatedAt())
                .downloadUrl("/api/v1/evidence/" + ef.getFileId() + "/download")
                .build())
            .toList();

        List<ObligationDetailView.HistoryItem> historyItems = history
            .findByObligationIdOrderByChangedAtDesc(obligationId).stream()
            .map(h -> ObligationDetailView.HistoryItem.builder()
                .classificationVersion(h.getClassificationVersion())
                .applicability(h.getApplicability()).tenantRiskRating(h.getTenantRiskRating())
                .assignedOwnerUserId(h.getAssignedOwnerUserId()).hasGap(h.getHasGap())
                .changeReason(h.getChangeReason()).changedByUserId(h.getChangedByUserId())
                .changedByName(h.getChangedByUserId() != null ? userNameById.get(h.getChangedByUserId()) : null)
                .changedAt(h.getChangedAt()).build())
            .toList();

        return ObligationDetailView.builder()
            .obligationId(ob.getObligationId())
            .obligationNumber(ob.getObligationNumber())
            .description(ob.getDescription())
            .sectionReference(ob.getSectionReference())
            .obligationType(ob.getObligationType())
            .recurringDeadlineType(ob.getRecurringDeadlineType())
            .instrumentId(ob.getInstrumentId())
            .sourceTitle(d != null ? d.getSourceTitle() : null)
            .regulatorAbbreviation(d != null ? d.getRegulatorAbbreviation() : null)
            .regulatorName(d != null ? d.getRegulatorName() : null)
            .pdfUrl(d != null ? d.getPdfUrl() : null)
            .applicability(c != null ? c.getApplicability() : null)
            .applicabilityReasoning(c != null ? c.getApplicabilityReasoning() : null)
            .tenantRiskRating(c != null ? c.getTenantRiskRating() : null)
            .riskJustification(c != null ? c.getRiskJustification() : null)
            .riskType(c != null ? c.getRiskType() : null)
            .impactRating(c != null ? c.getImpactRating() : null)
            .impactJustification(c != null ? c.getImpactJustification() : null)
            .likelihoodRating(c != null ? c.getLikelihoodRating() : null)
            .likelihoodJustification(c != null ? c.getLikelihoodJustification() : null)
            .inherentRiskRating(c != null ? c.getInherentRiskRating() : null)
            .residualRiskRating(c != null ? c.getResidualRiskRating() : null)
            .assignedOwnerUserId(c != null ? c.getAssignedOwnerUserId() : null)
            .assignedOwnerName(c != null ? c.getAssignedOwnerName() : null)
            .assignedDepartment(c != null ? c.getAssignedDepartment() : null)
            .hasGap(c != null ? c.getHasGap() : null)
            .gapDescription(c != null ? c.getGapDescription() : null)
            .status(c != null ? c.getStatus() : ob.getStatus())
            .classificationVersion(c != null ? c.getClassificationVersion() : null)
            .classifiedAt(c != null ? c.getClassifiedAt() : null)
            .classifiedByName(c != null && c.getClassifiedByUserId() != null ? userNameById.get(c.getClassifiedByUserId()) : null)
            .linkedControls(controls)
            .linkedReturns(returns)
            .evidence(evidence)
            .history(historyItems)
            .build();
    }

    @Transactional
    public void linkReturns(Long obligationId, List<Long> returnIds, Integer userId) {
        if (!obligationRepo.existsById(obligationId))
            throw new RuntimeException("Obligation not found: " + obligationId);
        obligationRepo.deleteReturnLinks(obligationId);
        if (returnIds != null) {
            for (Long rid : new LinkedHashSet<>(returnIds)) {
                obligationRepo.insertReturnLink(obligationId, rid);
            }
        }
        audit.log(userId, "link_returns", "obligation", obligationId, Map.of("returnIds", returnIds));
    }

    // ------------------------------------------------------------------ legacy instrument-level (inbox + api)

    public ObligationDetailResponse getDetail(Long instrumentId) {
        ObligationClassification c = classifications.findByInstrumentId(instrumentId)
            .orElseThrow(() -> new RuntimeException("Not found: " + instrumentId));
        PlatformInstrumentDetail d = platform.getInstrumentDetail(instrumentId);

        List<ObligationDetailResponse.ObligationItem> obligationItems = Collections.emptyList();
        if (c.getObligationId() != null) {
            var localObligations = obligationRepo.findByInstrumentId(instrumentId);
            obligationItems = localObligations.stream()
                .map(o -> ObligationDetailResponse.ObligationItem.builder()
                    .obligationId(o.getObligationId())
                    .obligationNumber(o.getObligationNumber())
                    .description(o.getDescription())
                    .sectionReference(o.getSectionReference())
                    .obligationType(o.getObligationType())
                    .effectiveDate(o.getEffectiveDate())
                    .status(o.getStatus())
                    .build())
                .toList();
        }

        List<ObligationDetailResponse.HistoryItem> historyItems = history
            .findByInstrumentIdOrderByChangedAtDesc(instrumentId).stream()
            .map(h -> ObligationDetailResponse.HistoryItem.builder()
                .classificationVersion(h.getClassificationVersion())
                .applicability(h.getApplicability())
                .tenantRiskRating(h.getTenantRiskRating())
                .assignedOwnerUserId(h.getAssignedOwnerUserId())
                .hasGap(h.getHasGap())
                .changeReason(h.getChangeReason())
                .changedByUserId(h.getChangedByUserId())
                .changedAt(h.getChangedAt())
                .build())
            .toList();

        return ObligationDetailResponse.builder()
            .instrumentId(c.getInstrumentId())
            .sourceTitle(d != null ? d.getSourceTitle() : null)
            .regulatorAbbreviation(d != null ? d.getRegulatorAbbreviation() : null)
            .regulatorName(d != null ? d.getRegulatorName() : null)
            .documentType(d != null ? d.getNature() : null)
            .platformRiskRating(d != null ? d.getRiskRating() : null)
            .aiSummary(d != null ? d.getAiSummary() : null)
            .dateIssued(d != null ? d.getDateIssued() : null)
            .effectiveDate(d != null ? d.getDateCommencement() : null)
            .publishedAt(d != null ? d.getPublishedAt() : null)
            .pdfUrl(d != null ? d.getPdfUrl() : null)
            .applicability(c.getApplicability())
            .applicabilityReasoning(c.getApplicabilityReasoning())
            .tenantRiskRating(c.getTenantRiskRating())
            .riskJustification(c.getRiskJustification())
            .riskType(c.getRiskType())
            .impactRating(c.getImpactRating())
            .impactJustification(c.getImpactJustification())
            .likelihoodRating(c.getLikelihoodRating())
            .likelihoodJustification(c.getLikelihoodJustification())
            .inherentRiskRating(c.getInherentRiskRating())
            .residualRiskRating(c.getResidualRiskRating())
            .assignedOwnerUserId(c.getAssignedOwnerUserId())
            .assignedOwnerName(c.getAssignedOwnerName())
            .assignedDepartment(c.getAssignedDepartment())
            .linkedControlIds(c.getLinkedControlIds())
            .hasGap(c.getHasGap())
            .gapDescription(c.getGapDescription())
            .status(c.getStatus())
            .classificationVersion(c.getClassificationVersion())
            .classifiedByUserId(c.getClassifiedByUserId())
            .classifiedAt(c.getClassifiedAt())
            .updatedAt(c.getUpdatedAt())
            .obligations(obligationItems)
            .history(historyItems)
            .build();
    }

    public Page<InboxItemResponse> getInbox(Pageable p) {
        Page<ObligationClassification> page = classifications.findByStatus("unclassified", p);
        List<InboxItemResponse> items = page.getContent().stream()
            .map(this::toInboxItem)
            .filter(Objects::nonNull)
            .toList();
        return new PageImpl<>(items, p, page.getTotalElements());
    }

    private InboxItemResponse toInboxItem(ObligationClassification c) {
        PlatformInstrumentDetail d = platform.getInstrumentDetail(c.getInstrumentId());
        if (d == null) return toInboxItemFallback(c);
        return InboxItemResponse.builder()
            .instrumentId(c.getInstrumentId()).obligationId(c.getObligationId())
            .sourceTitle(d.getSourceTitle()).regulatorAbbreviation(d.getRegulatorAbbreviation())
            .regulatorName(d.getRegulatorName()).documentType(d.getNature())
            .platformRiskRating(d.getRiskRating()).aiSummary(d.getAiSummary())
            .dateIssued(d.getDateIssued()).publishedAt(d.getPublishedAt())
            .pdfUrl(d.getPdfUrl()).status(c.getStatus())
            .obligationCount(d.getObligations() != null ? d.getObligations().size() : 0)
            .penaltySummary(d.getSanctions() != null && !d.getSanctions().isEmpty()
                ? "\u20A6" + d.getSanctions().get(0).getAmountNaira() + " penalty" : null)
            .pdfOcrText(d.getPdfOcrText())
            .applicability(c.getApplicability()).applicabilityReasoning(c.getApplicabilityReasoning())
            .tenantRiskRating(c.getTenantRiskRating()).riskJustification(c.getRiskJustification())
            .riskType(c.getRiskType()).impactRating(c.getImpactRating())
            .impactJustification(c.getImpactJustification()).likelihoodRating(c.getLikelihoodRating())
            .likelihoodJustification(c.getLikelihoodJustification()).inherentRiskRating(c.getInherentRiskRating())
            .residualRiskRating(c.getResidualRiskRating())
            .assignedOwnerUserId(c.getAssignedOwnerUserId()).assignedOwnerName(c.getAssignedOwnerName())
            .assignedDepartment(c.getAssignedDepartment()).linkedControlIds(c.getLinkedControlIds())
            .hasGap(c.getHasGap()).gapDescription(c.getGapDescription())
            .classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt()).updatedAt(c.getUpdatedAt()).build();
    }

    private InboxItemResponse toInboxItemFallback(ObligationClassification c) {
        return InboxItemResponse.builder()
            .instrumentId(c.getInstrumentId()).obligationId(c.getObligationId())
            .sourceTitle("Instrument " + c.getInstrumentId()).status(c.getStatus())
            .applicability(c.getApplicability()).build();
    }

    public List<ObligationClassificationDto> getGaps() {
        return classifications.findByHasGapTrue().stream().map(this::toDto).toList();
    }

    @Transactional
    public ObligationClassificationDto classify(Long obligationId, ClassifyObligationRequest req, Integer userId) {
        Obligation ob = obligationRepo.findById(obligationId)
            .orElseThrow(() -> new RuntimeException("Obligation not found: " + obligationId));
        ObligationClassification c = classifications.findByObligationId(obligationId)
            .orElse(ObligationClassification.builder()
                .instrumentId(ob.getInstrumentId())
                .obligationId(obligationId)
                .build());
        if (c.getClassificationId() != null) {
            history.save(ClassificationHistory.builder()
                .instrumentId(ob.getInstrumentId()).obligationId(obligationId)
                .classificationVersion(c.getClassificationVersion())
                .applicability(c.getApplicability()).tenantRiskRating(c.getTenantRiskRating())
                .assignedOwnerUserId(c.getAssignedOwnerUserId()).hasGap(c.getHasGap())
                .changeReason(req.getChangeReason()).changedByUserId(userId).build());
            c.setClassificationVersion(c.getClassificationVersion() + 1);
        }
        c.setApplicability(req.getApplicability());
        if (req.getApplicabilityReasoning() != null) c.setApplicabilityReasoning(req.getApplicabilityReasoning());
        if (req.getTenantRiskRating() != null) c.setTenantRiskRating(req.getTenantRiskRating());
        if (req.getRiskJustification() != null) c.setRiskJustification(req.getRiskJustification());
        if (req.getRiskType() != null) c.setRiskType(req.getRiskType());
        if (req.getImpactRating() != null) c.setImpactRating(req.getImpactRating());
        if (req.getImpactJustification() != null) c.setImpactJustification(req.getImpactJustification());
        if (req.getLikelihoodRating() != null) c.setLikelihoodRating(req.getLikelihoodRating());
        if (req.getLikelihoodJustification() != null) c.setLikelihoodJustification(req.getLikelihoodJustification());
        if (req.getAssignedOwnerUserId() != null) c.setAssignedOwnerUserId(req.getAssignedOwnerUserId());
        if (req.getAssignedOwnerName() != null) c.setAssignedOwnerName(req.getAssignedOwnerName());
        if (req.getAssignedDepartment() != null) c.setAssignedDepartment(req.getAssignedDepartment());
        if (req.getLinkedControlIds() != null) c.setLinkedControlIds(req.getLinkedControlIds());
        if (req.getHasGap() != null) c.setHasGap(req.getHasGap());
        if (req.getGapDescription() != null) c.setGapDescription(req.getGapDescription());
        c.setClassifiedByUserId(userId);
        c.setClassifiedAt(Instant.now());
        c.setStatus("active");
        ObligationClassification saved = classifications.save(c);
        if (req.getLinkedReturnIds() != null) {
            Long targetObligation = req.getLinkedObligationId() != null
                ? req.getLinkedObligationId() : obligationId;
            linkReturns(targetObligation, req.getLinkedReturnIds(), userId);
        }
        audit.log(userId, "classify_obligation", "obligation", obligationId, Map.of("applicability", req.getApplicability()));
        return toDto(saved);
    }

    public List<?> getHistory(Long instrumentId) {
        return history.findByInstrumentIdOrderByChangedAtDesc(instrumentId);
    }

    private ObligationClassificationDto toDto(ObligationClassification c) {
        return ObligationClassificationDto.builder()
            .instrumentId(c.getInstrumentId()).obligationId(c.getObligationId()).applicability(c.getApplicability())
            .applicabilityReasoning(c.getApplicabilityReasoning())
            .tenantRiskRating(c.getTenantRiskRating()).riskJustification(c.getRiskJustification())
            .riskType(c.getRiskType()).impactRating(c.getImpactRating())
            .impactJustification(c.getImpactJustification())
            .likelihoodRating(c.getLikelihoodRating()).likelihoodJustification(c.getLikelihoodJustification())
            .inherentRiskRating(c.getInherentRiskRating()).residualRiskRating(c.getResidualRiskRating())
            .assignedOwnerUserId(c.getAssignedOwnerUserId()).assignedOwnerName(c.getAssignedOwnerName())
            .assignedDepartment(c.getAssignedDepartment())
            .linkedControlIds(c.getLinkedControlIds()).hasGap(c.getHasGap())
            .gapDescription(c.getGapDescription())
            .status(c.getStatus()).classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt()).updatedAt(c.getUpdatedAt()).build();
    }
}
