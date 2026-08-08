package com.atheris.compliance.tenant.backend.modules.review.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.review.dto.*;
import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewObligation;
import com.atheris.compliance.tenant.backend.modules.review.repository.PendingReviewRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ReviewService {

    private final PendingReviewRepository reviews;
    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classifications;
    private final PlatformApiClient platform;
    private final AuditService audit;
    private final OwnerRepository ownerRepo;
    private final DepartmentRepository departmentRepo;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public Page<ReviewItem> list(String source, String status, String q, Pageable p) {
        List<PendingReview> all = reviews.findByTenantIdAndStatus(tenantId, "pending");
        if ("intel".equals(source) || "upload".equals(source)) {
            all = all.stream().filter(r -> source.equals(r.getSource())).collect(Collectors.toList());
        }
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            all = all.stream().filter(r -> contains(r.getSourceTitle(), needle)
                || contains(r.getRegulatorName(), needle)
                || contains(r.getRegulatorAbbreviation(), needle)).collect(Collectors.toList());
        }
        all.sort(Comparator.comparing(PendingReview::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        List<ReviewItem> items = all.stream()
            .map(this::toItem)
            .collect(Collectors.toList());
        int total = items.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ReviewItem> page = start >= total ? List.of() : items.subList(start, end);
        return new PageImpl<>(page, p, total);
    }

    public ReviewStats stats() {
        long pending = reviews.countByTenantIdAndStatus(tenantId, "pending");
        long intel = reviews.countByTenantIdAndStatusAndSource(tenantId, "pending", "intel");
        long upload = reviews.countByTenantIdAndStatusAndSource(tenantId, "pending", "upload");
        List<String> regulators = reviews.findByTenantIdAndStatus(tenantId, "pending").stream()
            .map(r -> r.getRegulatorAbbreviation() != null ? r.getRegulatorAbbreviation() : r.getRegulatorName())
            .filter(Objects::nonNull).filter(s -> !s.isBlank())
            .collect(Collectors.toCollection(TreeSet::new)).stream().toList();
        return ReviewStats.builder()
            .total(pending).intel(intel).upload(upload).regulators(regulators).build();
    }

    public ReviewDetail get(Long reviewId) {
        PendingReview r = find(reviewId);
        List<ReviewDetail.ReviewObligationDto> obligations = r.getObligations() != null
            ? r.getObligations().stream().map(o -> ReviewDetail.ReviewObligationDto.builder()
                .obligationNumber(o.getObligationNumber())
                .description(o.getDescription())
                .sectionReference(o.getSectionReference())
                .obligationType(o.getObligationType())
                .recurringDeadlineType(o.getRecurringDeadlineType())
                .applicable(o.getApplicable() != null ? o.getApplicable() : true)
                .build()).collect(Collectors.toList())
            : List.of();

        String aiSummary = null;
        String pdfOcrText = null;
        if (r.getInstrumentId() != null) {
            PlatformInstrumentDetail d = platform.getInstrumentDetail(r.getInstrumentId());
            if (d != null) {
                if (r.getSourceTitle() == null) r.setSourceTitle(d.getSourceTitle());
                if (r.getPdfUrl() == null) r.setPdfUrl(d.getPdfUrl());
                aiSummary = d.getAiSummary();
                pdfOcrText = d.getPdfOcrText();
            }
        }

        return ReviewDetail.builder()
            .reviewId(r.getReviewId())
            .source(r.getSource())
            .instrumentId(r.getInstrumentId())
            .uploadId(r.getUploadId() != null ? r.getUploadId().toString() : null)
            .sourceTitle(r.getSourceTitle())
            .sourceReferenceNumber(r.getSourceReferenceNumber())
            .regulatorId(r.getRegulatorId())
            .regulatorAbbreviation(r.getRegulatorAbbreviation())
            .regulatorName(r.getRegulatorName())
            .documentType(r.getDocumentType())
            .riskRating(r.getRiskRating())
            .dateIssued(r.getDateIssued())
            .effectiveDate(r.getEffectiveDate())
            .publishedAt(r.getPublishedAt())
            .pdfUrl(r.getPdfUrl())
            .aiSummary(aiSummary)
            .pdfOcrText(pdfOcrText)
            .status(r.getStatus())
            .createdAt(r.getCreatedAt())
            .obligations(obligations)
            .build();
    }

    @Transactional
    public void save(Long reviewId, SaveReviewRequest req, Integer userId) {
        PendingReview r = find(reviewId);
        if (r.getInstrumentId() == null) {
            throw new IllegalArgumentException("Cannot save: instrument not ready yet");
        }
        Long instrumentId = r.getInstrumentId();
        obligationRepo.deleteByInstrumentId(instrumentId);
        classifications.deleteByInstrumentId(instrumentId);

        List<Obligation> savedObligations = new ArrayList<>();
        if (req.getObligations() != null) {
            int num = 1;
            for (SaveReviewRequest.ObligationDto o : req.getObligations()) {
                if (o.getApplicable() != null && !o.getApplicable()) continue;
                Obligation ob = Obligation.builder()
                    .instrumentId(instrumentId)
                    .obligationNumber(o.getObligationNumber() != null ? o.getObligationNumber() : num)
                    .description(o.getDescription())
                    .sectionReference(o.getSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .effectiveDate(r.getEffectiveDate() != null ? r.getEffectiveDate() : r.getDateIssued())
                    .source("ai_extracted".equals(r.getSource()) ? "ai_extracted" : "manual_upload")
                    .build();
                ob = obligationRepo.save(ob);

                ObligationClassification c = classifications.findByObligationId(ob.getObligationId())
                    .orElse(ObligationClassification.builder()
                        .instrumentId(instrumentId)
                        .obligationId(ob.getObligationId())
                        .build());
                c.setApplicability(o.getApplicability() != null ? o.getApplicability() : "applicable");
                if (o.getApplicabilityReasoning() != null) c.setApplicabilityReasoning(o.getApplicabilityReasoning());
                if (o.getTenantRiskRating() != null) c.setTenantRiskRating(o.getTenantRiskRating());
                if (o.getRiskJustification() != null) c.setRiskJustification(o.getRiskJustification());
                if (o.getRiskType() != null) c.setRiskType(o.getRiskType());
                if (o.getImpactRating() != null) c.setImpactRating(o.getImpactRating());
                if (o.getImpactJustification() != null) c.setImpactJustification(o.getImpactJustification());
                if (o.getLikelihoodRating() != null) c.setLikelihoodRating(o.getLikelihoodRating());
                if (o.getLikelihoodJustification() != null) c.setLikelihoodJustification(o.getLikelihoodJustification());
                if (o.getAssignedOwnerUserId() != null) c.setAssignedOwnerUserId(o.getAssignedOwnerUserId());
                applyOwner(c, o);
                if (o.getHasGap() != null) c.setHasGap(o.getHasGap());
                if (o.getGapDescription() != null) c.setGapDescription(o.getGapDescription());
                c.setClassifiedByUserId(userId);
                c.setClassifiedAt(Instant.now());
                c.setStatus("active");
                if (c.getClassificationVersion() == null) c.setClassificationVersion(1);
                classifications.save(c);

                if (o.getLinkedReturnIds() != null && !o.getLinkedReturnIds().isEmpty()) {
                    linkReturns(ob.getObligationId(), o.getLinkedReturnIds());
                }
                savedObligations.add(ob);
                num++;
            }
        }

        r.setStatus("saved");
        reviews.save(r);

        audit.log(userId, "review_saved", "instrument", instrumentId,
            Map.of("applicability", "active", "obligations", savedObligations.size()));
        log.info("Review {} saved: {} obligations with per-obligation classification for instrument {}",
            reviewId, savedObligations.size(), instrumentId);
    }

    @Transactional
    public void skip(Long reviewId, Integer userId) {
        PendingReview r = find(reviewId);
        r.setStatus("skipped");
        reviews.save(r);
        if (r.getInstrumentId() != null) {
            audit.log(userId, "review_skipped", "instrument", r.getInstrumentId(), Map.of());
        }
        log.info("Review {} skipped", reviewId);
    }

    // -------------------------------------------------------------- helpers

    private void applyOwner(ObligationClassification c, SaveReviewRequest.ObligationDto o) {
        if (o.getAssignedOwnerId() == null) {
            if (o.getAssignedOwnerName() != null) c.setAssignedOwnerName(o.getAssignedOwnerName());
            if (o.getAssignedDepartment() != null) c.setAssignedDepartment(o.getAssignedDepartment());
            return;
        }
        Owner owner = ownerRepo.findById(o.getAssignedOwnerId())
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + o.getAssignedOwnerId()));
        c.setAssignedOwnerId(owner.getOwnerId());
        c.setAssignedTeamId(owner.getTeamId());
        c.setAssignedDepartmentId(owner.getDepartmentId());
        c.setAssignedOwnerName(owner.getFullName());
        c.setAssignedDepartment(owner.getDepartmentId() != null
            ? departmentRepo.findById(owner.getDepartmentId())
                .map(Department::getName)
                .orElse(null)
            : null);
    }

    private PendingReview find(Long reviewId) {
        return reviews.findByReviewIdAndTenantId(reviewId, tenantId)
            .orElseThrow(() -> new RuntimeException("Review not found: " + reviewId));
    }

    private void linkReturns(Long obligationId, List<Long> returnIds) {
        obligationRepo.deleteReturnLinks(obligationId);
        if (returnIds != null) {
            for (Long rid : new LinkedHashSet<>(returnIds)) {
                obligationRepo.insertReturnLink(obligationId, rid);
            }
        }
    }

    private ReviewItem toItem(PendingReview r) {
        int count = r.getObligations() != null
            ? r.getObligations().stream().filter(o -> o.getApplicable() == null || o.getApplicable()).mapToInt(x -> 1).sum()
            : 0;
        return ReviewItem.builder()
            .reviewId(r.getReviewId())
            .source(r.getSource())
            .instrumentId(r.getInstrumentId())
            .sourceTitle(r.getSourceTitle())
            .sourceReferenceNumber(r.getSourceReferenceNumber())
            .regulatorId(r.getRegulatorId() != null ? r.getRegulatorId().toString() : null)
            .regulatorAbbreviation(r.getRegulatorAbbreviation())
            .regulatorName(r.getRegulatorName())
            .documentType(r.getDocumentType())
            .riskRating(r.getRiskRating())
            .dateIssued(r.getDateIssued())
            .publishedAt(r.getPublishedAt())
            .status(r.getStatus())
            .obligationCount(count)
            .createdAt(r.getCreatedAt())
            .build();
    }

    private static boolean contains(String s, String needle) {
        return s != null && s.toLowerCase().contains(needle);
    }
}
