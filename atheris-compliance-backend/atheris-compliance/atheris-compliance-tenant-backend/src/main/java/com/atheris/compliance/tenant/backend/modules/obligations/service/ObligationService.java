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

@Service
@Slf4j
@RequiredArgsConstructor
public class ObligationService {

    private final ObligationClassificationRepository classifications;
    private final ClassificationHistoryRepository history;
    private final AuditService audit;
    private final PlatformApiClient platform;

    public Page<ObligationClassificationDto> findAll(String applicability, String status, Pageable p) {
        Page<ObligationClassification> page;
        if (applicability != null)
            page = classifications.findByApplicability(applicability, p);
        else if (status != null)
            page = classifications.findByStatus(status, p);
        else
            page = classifications.findAll(p);
        return page.map(this::toDto);
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
            .instrumentId(c.getInstrumentId())
            .obligationId(c.getObligationId())
            .sourceTitle(d.getSourceTitle())
            .regulatorAbbreviation(d.getRegulatorAbbreviation())
            .regulatorName(d.getRegulatorName())
            .documentType(d.getNature())
            .platformRiskRating(d.getRiskRating())
            .aiSummary(d.getAiSummary())
            .dateIssued(d.getDateIssued())
            .publishedAt(d.getPublishedAt())
            .pdfUrl(d.getPdfUrl())
            .status(c.getStatus())
            .obligationCount(d.getObligations() != null ? d.getObligations().size() : 0)
            .penaltySummary(d.getSanctions() != null && !d.getSanctions().isEmpty()
                ? "₦" + d.getSanctions().get(0).getAmountNaira() + " penalty"
                : null)
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
            .classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt())
            .updatedAt(c.getUpdatedAt()).build();
    }

    private InboxItemResponse toInboxItemFallback(ObligationClassification c) {
        return InboxItemResponse.builder()
            .instrumentId(c.getInstrumentId())
            .obligationId(c.getObligationId())
            .sourceTitle("Instrument " + c.getInstrumentId())
            .status(c.getStatus())
            .applicability(c.getApplicability()).build();
    }

    public ObligationClassificationDto findByInstrumentId(Long id) {
        return toDto(classifications.findByInstrumentId(id)
            .orElseThrow(() -> new RuntimeException("Not found: " + id)));
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
                .instrumentId(instrumentId)
                .classificationVersion(c.getClassificationVersion())
                .applicability(c.getApplicability())
                .tenantRiskRating(c.getTenantRiskRating())
                .assignedOwnerUserId(c.getAssignedOwnerUserId())
                .hasGap(c.getHasGap())
                .changeReason(req.getChangeReason())
                .changedByUserId(userId).build());
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
            .linkedControlIds(c.getLinkedControlIds()).hasGap(c.getHasGap())
            .gapDescription(c.getGapDescription())
            .status(c.getStatus()).classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt()).updatedAt(c.getUpdatedAt()).build();
    }
}
