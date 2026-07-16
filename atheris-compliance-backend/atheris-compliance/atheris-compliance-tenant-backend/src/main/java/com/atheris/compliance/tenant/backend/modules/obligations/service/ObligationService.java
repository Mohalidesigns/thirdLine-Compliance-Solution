package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.dto.*;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.*;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ObligationService {

    private final ObligationClassificationRepository classifications;
    private final ClassificationHistoryRepository history;
    private final AuditService audit;

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

    public Page<ObligationClassificationDto> getInbox(Pageable p) {
        return classifications.findByStatus("unclassified", p).map(this::toDto);
    }

    public ObligationClassificationDto findByInstrumentId(Long id) {
        return toDto(classifications.findByInstrumentId(id)
            .orElseThrow(() -> new RuntimeException("Not found: " + id)));
    }

    public List<ObligationClassificationDto> getGaps() {
        return classifications.findByHasGapTrue().stream().map(this::toDto).toList();
    }

    public List<ObligationClassificationDto> getHighRiskPendingApproval() {
        return classifications.findByApplicabilityAndCcoApprovedFalseAndTenantRiskRating("applicable", "High").stream().map(this::toDto).toList();
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
        if (req.getAssignedOwnerUserId() != null) c.setAssignedOwnerUserId(req.getAssignedOwnerUserId());
        if (req.getLinkedControlIds() != null) c.setLinkedControlIds(req.getLinkedControlIds());
        if (req.getHasGap() != null) c.setHasGap(req.getHasGap());
        if (req.getGapDescription() != null) c.setGapDescription(req.getGapDescription());
        c.setClassifiedByUserId(userId);
        c.setClassifiedAt(Instant.now());
        c.setStatus("classified");
        ObligationClassification saved = classifications.save(c);
        audit.log(userId, "classify_obligation", "obligation", instrumentId, Map.of("applicability", req.getApplicability()));
        return toDto(saved);
    }

    @Transactional
    public ObligationClassificationDto ccoApprove(Long instrumentId, Integer ccoUserId) {
        ObligationClassification c = classifications.findByInstrumentId(instrumentId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        c.setCcoApproved(true);
        c.setCcoApprovedByUserId(ccoUserId);
        c.setCcoApprovedAt(Instant.now());
        c.setStatus("active");
        audit.log(ccoUserId, "cco_approve_obligation", "obligation", instrumentId, Map.of());
        return toDto(classifications.save(c));
    }

    public List<?> getHistory(Long instrumentId) {
        return history.findByInstrumentIdOrderByChangedAtDesc(instrumentId);
    }

    private ObligationClassificationDto toDto(ObligationClassification c) {
        return ObligationClassificationDto.builder()
            .instrumentId(c.getInstrumentId()).applicability(c.getApplicability())
            .applicabilityReasoning(c.getApplicabilityReasoning())
            .tenantRiskRating(c.getTenantRiskRating()).riskJustification(c.getRiskJustification())
            .assignedOwnerUserId(c.getAssignedOwnerUserId()).assignedOwnerName(c.getAssignedOwnerName())
            .linkedControlIds(c.getLinkedControlIds()).hasGap(c.getHasGap())
            .gapDescription(c.getGapDescription()).ccoApproved(c.getCcoApproved())
            .status(c.getStatus()).classificationVersion(c.getClassificationVersion())
            .classifiedAt(c.getClassifiedAt()).updatedAt(c.getUpdatedAt()).build();
    }
}
