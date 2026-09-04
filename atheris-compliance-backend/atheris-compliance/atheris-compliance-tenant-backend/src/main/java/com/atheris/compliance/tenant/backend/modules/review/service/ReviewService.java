package com.atheris.compliance.tenant.backend.modules.review.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationSanctionRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.review.dto.*;
import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewObligation;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewSanction;
import com.atheris.compliance.tenant.backend.modules.review.repository.PendingReviewRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ReviewService {

    private final PendingReviewRepository reviews;
    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classifications;
    private final RegulatorySanctionRepository sanctionRepo;
    private final ObligationSanctionRepository obligationSanctionRepo;
    private final PlatformApiClient platform;
    private final AuditService audit;
    private final OwnerRepository ownerRepo;
    private final DepartmentRepository departmentRepo;
    private final TenantIdentityService tenantIdentity;

    @PersistenceContext
    private EntityManager em;

    public Page<ReviewItem> list(String source, String status, String q, Pageable p) {
        List<PendingReview> all = reviews.findByTenantIdAndStatus(tenantIdentity.currentTenantId(), "pending");
        if ("intel".equals(source) || "upload".equals(source)) {
            all = all.stream().filter(r -> source.equals(r.getSource())).collect(Collectors.toList());
        }
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            all = all.stream().filter(r -> contains(r.getSourceTitle(), needle)
                || contains(r.getRegulatorName(), needle)
                || contains(r.getRegulatorAbbreviation(), needle)).collect(Collectors.toList());
        }
        all.sort(reviewComparator(p));

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
        Long tid = tenantIdentity.currentTenantId();
        long pending = reviews.countByTenantIdAndStatus(tid, "pending");
        long intel = reviews.countByTenantIdAndStatusAndSource(tid, "pending", "intel");
        long upload = reviews.countByTenantIdAndStatusAndSource(tid, "pending", "upload");
        List<String> regulators = reviews.findByTenantIdAndStatus(tid, "pending").stream()
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
                .title(o.getTitle())
                .description(o.getDescription())
                .plainEnglishStatement(o.getPlainEnglishStatement())
                .sectionReference(o.getSectionReference())
                .areaOfFocus(o.getAreaOfFocus())
                .obligationType(o.getObligationType())
                .recurringDeadlineType(o.getRecurringDeadlineType())
                .riskDescription(o.getRiskDescription())
                .inherentLikelihood(o.getInherentLikelihood())
                .inherentImpact(o.getInherentImpact())
                .inherentRiskRating(o.getInherentRiskRating())
                .controlOwner(o.getControlOwner())
                .regulationId(o.getRegulationId())
                .actName(o.getActName())
                .applicable(o.getApplicable() != null ? o.getApplicable() : true)
                .build()).collect(Collectors.toList())
            : List.of();

        List<ReviewDetail.ReviewSanctionDto> sanctions = r.getSanctions() != null
            ? r.getSanctions().stream().map(s -> ReviewDetail.ReviewSanctionDto.builder()
                .sanctionType(s.getSanctionType())
                .amountNaira(s.getAmountNaira())
                .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                .liableRoles(s.getLiableRoles())
                .severityScore(s.getSeverityScore())
                .hasBeenEnforced(s.getHasBeenEnforced())
                .description(s.getDescription())
                .sourceSectionReference(s.getSourceSectionReference())
                .riskExplanation(s.getRiskExplanation())
                .penaltyDetails(s.getPenaltyDetails())
                .regulationId(s.getRegulationId())
                .actName(s.getActName())
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
                if ((sanctions == null || sanctions.isEmpty()) && d.getSanctions() != null && !d.getSanctions().isEmpty()) {
                    sanctions = d.getSanctions().stream().map(s -> ReviewDetail.ReviewSanctionDto.builder()
                        .sanctionType(s.getSanctionType())
                        .amountNaira(s.getAmountNaira())
                        .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                        .liableRoles(s.getLiableRoles())
                        .severityScore(s.getSeverityScore())
                        .hasBeenEnforced(s.getHasBeenEnforced())
                        .description(s.getDescription())
                        .sourceSectionReference(s.getSourceSectionReference())
                        .riskExplanation(s.getRiskExplanation())
                        .penaltyDetails(s.getPenaltyDetails())
                        .regulationId(s.getRegulationId())
                        .actName(s.getActName())
                        .build()).collect(Collectors.toList());
                    try {
                        List<ReviewSanction> toPersist = d.getSanctions().stream().map(s -> ReviewSanction.builder()
                            .sanctionType(s.getSanctionType())
                            .amountNaira(s.getAmountNaira())
                            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                            .liableRoles(s.getLiableRoles())
                            .severityScore(s.getSeverityScore())
                            .hasBeenEnforced(s.getHasBeenEnforced())
                            .description(s.getDescription())
                            .sourceSectionReference(s.getSourceSectionReference())
                            .riskExplanation(s.getRiskExplanation())
                            .penaltyDetails(s.getPenaltyDetails())
                            .regulationId(s.getRegulationId())
                            .actName(s.getActName())
                            .build()).collect(Collectors.toList());
                        r.setSanctions(toPersist);
                        reviews.save(r);
                    } catch (Throwable ignored) {
                        log.warn("Lazy sanction backfill failed for review {}: {}", reviewId, ignored.getMessage());
                    }
                }
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
            .sanctions(sanctions != null ? sanctions : List.of())
            .build();
    }

    @Transactional
    public void save(Long reviewId, SaveReviewRequest req, Integer userId) {
        try {
            PendingReview r = find(reviewId);
            if (r.getInstrumentId() == null) {
                throw new IllegalArgumentException("Cannot save: instrument not ready yet");
            }
            Long instrumentId = r.getInstrumentId();
            obligationRepo.deleteByInstrumentId(instrumentId);
            classifications.deleteByInstrumentId(instrumentId);
            // clean existing sanctions for this instrument (join cascades via obligation delete, sanctions remain orphaned — keep deduped rows)
            // we keep sanction rows for dedup but remove stale join already cascaded

            List<Obligation> savedObligations = new ArrayList<>();
            if (req.getObligations() != null) {
                int num = 1;
                for (SaveReviewRequest.ObligationDto o : req.getObligations()) {
                    if (o.getApplicable() != null && !o.getApplicable()) continue;

                    Obligation ob = Obligation.builder()
                        .instrumentId(instrumentId)
                        .obligationNumber(o.getObligationNumber() != null ? o.getObligationNumber() : num)
                        .title(shorten(o.getTitle(), 500))
                        .description(shorten(o.getDescription(), 2000))
                        .plainEnglishStatement(shorten(o.getPlainEnglishStatement(), 2000))
                        .actName(shorten(o.getActName(), 500))
                        .regulationId(o.getRegulationId())
                        .sectionReference(shorten(o.getSectionReference(), 255))
                        .areaOfFocus(o.getAreaOfFocus())
                        .obligationType(o.getObligationType())
                        .recurringDeadlineType(o.getRecurringDeadlineType())
                        .effectiveDate(r.getEffectiveDate() != null ? r.getEffectiveDate() : r.getDateIssued())
                        .source("ai_extracted".equals(r.getSource()) ? "ai_extracted" : "manual_upload")
                        .riskDescription(o.getRiskDescription())
                        .inherentLikelihood(o.getInherentLikelihood())
                        .inherentImpact(o.getInherentImpact())
                        .inherentRiskRating(o.getInherentRiskRating())
                        .controlOwner(shorten(o.getControlOwner(), 500))
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

            // persist sanctions: for each ReviewSanction in PendingReview.sanctions, upsert into regulatory_sanctions and link to each created obligation
            List<ReviewSanction> pendingSanctions = r.getSanctions() != null ? r.getSanctions() : List.of();
            // also consider platform-supplied sanctions fallback if pending empty but platform detail has them
            if (pendingSanctions.isEmpty() && r.getInstrumentId() != null) {
                PlatformInstrumentDetail d = platform.getInstrumentDetail(r.getInstrumentId());
                if (d != null && d.getSanctions() != null && !d.getSanctions().isEmpty()) {
                    pendingSanctions = d.getSanctions().stream().map(s -> ReviewSanction.builder()
                        .sanctionType(s.getSanctionType())
                        .amountNaira(s.getAmountNaira())
                        .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                        .liableRoles(s.getLiableRoles())
                        .severityScore(s.getSeverityScore())
                        .hasBeenEnforced(s.getHasBeenEnforced())
                        .description(s.getDescription())
                        .sourceSectionReference(s.getSourceSectionReference())
                        .riskExplanation(s.getRiskExplanation())
                        .penaltyDetails(s.getPenaltyDetails())
                        .regulationId(s.getRegulationId())
                        .actName(s.getActName())
                        .build()).collect(Collectors.toList());
                }
            }
            if (!pendingSanctions.isEmpty() && !savedObligations.isEmpty()) {
                for (ReviewSanction rs : pendingSanctions) {
                    RegulatorySanction persisted = findOrCreateSanction(rs, instrumentId);
                    for (Obligation ob : savedObligations) {
                        try {
                            obligationSanctionRepo.insertSanctionLink(ob.getObligationId(), persisted.getSanctionId());
                        } catch (Throwable ex) {
                            log.warn("Failed to link sanction {} to obligation {}: {}", persisted.getSanctionId(), ob.getObligationId(), ex.getMessage());
                        }
                    }
                }
            }

            r.setStatus("saved");
            reviews.save(r);

            audit.log(userId, "review_saved", "instrument", instrumentId,
                Map.of("applicability", "active", "obligations", savedObligations.size(), "sanctions", pendingSanctions.size()));
            log.info("Review {} saved: {} obligations, {} sanctions linked for instrument {}",
                reviewId, savedObligations.size(), pendingSanctions.size(), instrumentId);
        } catch (Throwable e) {
            log.error("Review save failed for {}: {}", reviewId, e.getMessage(), e);
            try { if (em != null) em.clear(); } catch (Throwable ignored) {}
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
        }
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

    private RegulatorySanction findOrCreateSanction(ReviewSanction rs, Long instrumentId) {
        String descNorm = normalize(rs.getDescription());
        String secNorm = normalize(rs.getSourceSectionReference());
        String actNorm = normalize(rs.getActName());
        List<RegulatorySanction> existing = sanctionRepo.findByInstrumentId(instrumentId);
        for (RegulatorySanction s : existing) {
            if (normalize(s.getDescription()).equals(descNorm)
                && normalize(s.getSourceSectionReference()).equals(secNorm)
                && normalize(s.getRegulationName()).equals(actNorm)) {
                return s;
            }
        }
        RegulatorySanction news = RegulatorySanction.builder()
            .instrumentId(instrumentId)
            .regulationId(rs.getRegulationId())
            .regulationName(shorten(rs.getActName(), 500))
            .sanctionType(shorten(rs.getSanctionType(), 100))
            .sanctionAmountNaira(rs.getAmountNaira())
            .sanctionAmountPerDay(rs.getSanctionAmountPerDay() != null ? rs.getSanctionAmountPerDay() : false)
            .liableRoles(rs.getLiableRoles())
            .severityScore(rs.getSeverityScore())
            .hasBeenEnforced(rs.getHasBeenEnforced() != null ? rs.getHasBeenEnforced() : false)
            .description(rs.getDescription())
            .sourceSectionReference(shorten(rs.getSourceSectionReference(), 255))
            .riskExplanation(rs.getRiskExplanation())
            .penaltyDetails(rs.getPenaltyDetails())
            .build();
        return sanctionRepo.save(news);
    }

    private static String normalize(String s) {
        return s != null ? s.trim().toLowerCase() : "";
    }

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
        return reviews.findByReviewIdAndTenantId(reviewId, tenantIdentity.currentTenantId())
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

    private Comparator<PendingReview> reviewComparator(Pageable p) {
        Comparator<PendingReview> cmp;
        if (p.getSort().isSorted()) {
            String field = p.getSort().iterator().next().getProperty();
            boolean asc = p.getSort().iterator().next().isAscending();
            cmp = switch (field) {
                case "source" -> Comparator.comparing(r -> nullSafe(r.getSource()));
                case "sourceTitle" -> Comparator.comparing(r -> nullSafe(r.getSourceTitle()));
                case "regulatorAbbreviation" -> Comparator.comparing(
                    r -> nullSafe(r.getRegulatorAbbreviation() != null ? r.getRegulatorAbbreviation() : r.getRegulatorName()));
                case "riskRating" -> Comparator.comparing(r -> nullSafe(r.getRiskRating()));
                case "createdAt" -> Comparator.comparing(PendingReview::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
                default -> Comparator.comparing(PendingReview::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
            };
            return asc ? cmp : cmp.reversed();
        }
        return Comparator.comparing(PendingReview::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private static String nullSafe(String s) {
        return s != null ? s : "";
    }

    private static String shorten(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max);
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
