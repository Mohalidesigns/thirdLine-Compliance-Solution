package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.dto.*;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.*;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.*;
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
    private final AuditService audit;
    private final PlatformApiClient platform;

    public Page<ObligationRegisterItem> getRegisterList(
            String applicability, String tenantRiskRating, Boolean hasGap,
            Integer assignedOwnerUserId, String status, Pageable p) {
        var spec = ObligationSpecification.withFilters(
            applicability, tenantRiskRating, hasGap, assignedOwnerUserId, status);
        Page<ObligationClassification> page = classifications.findAll(spec, p);
        List<ObligationRegisterItem> items = page.getContent().stream()
            .map(this::toRegisterItem)
            .toList();
        return new PageImpl<>(items, p, page.getTotalElements());
    }

    private ObligationRegisterItem toRegisterItem(ObligationClassification c) {
        PlatformInstrumentDetail d = platform.getInstrumentDetail(c.getInstrumentId());
        String obligationDesc = null;
        Integer obligationNum = null;
        if (c.getObligationId() != null) {
            var opt = obligationRepo.findById(c.getObligationId());
            if (opt.isPresent()) {
                obligationDesc = opt.get().getDescription();
                obligationNum = opt.get().getObligationNumber();
            }
        }
        return ObligationRegisterItem.builder()
            .instrumentId(c.getInstrumentId())
            .obligationId(c.getObligationId())
            .sourceTitle(d != null ? d.getSourceTitle() : "Instrument " + c.getInstrumentId())
            .regulatorAbbreviation(d != null ? d.getRegulatorAbbreviation() : null)
            .obligationDescription(obligationDesc)
            .obligationNumber(obligationNum)
            .tenantRiskRating(c.getTenantRiskRating())
            .assignedOwnerName(c.getAssignedOwnerName())
            .status(c.getStatus())
            .hasGap(c.getHasGap())
            .inherentRiskRating(c.getInherentRiskRating())
            .classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt())
            .updatedAt(c.getUpdatedAt()).build();
    }

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
    public ObligationClassificationDto classify(Long instrumentId, ClassifyObligationRequest req, Integer userId) {
        ObligationClassification c = classifications.findByInstrumentId(instrumentId)
            .orElse(ObligationClassification.builder().instrumentId(instrumentId).build());
        if (c.getClassificationId() != null) {
            history.save(ClassificationHistory.builder()
                .instrumentId(instrumentId).obligationId(c.getObligationId())
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
        audit.log(userId, "classify_obligation", "obligation", instrumentId, Map.of("applicability", req.getApplicability()));
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
