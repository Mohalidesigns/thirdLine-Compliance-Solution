package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewObligation;
import com.atheris.compliance.tenant.backend.modules.review.repository.PendingReviewRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.*;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.UploadJob;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.UploadJobRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.IngestResponseDto;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service @Slf4j @RequiredArgsConstructor
public class UploadService {

    private final UploadJobRepository uploadJobs;
    private final TenantRegulatorRepository tenantRegulators;
    private final PlatformApiClient platformClient;
    private final PendingReviewRepository pendingReviews;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    @Transactional
    public UploadJobResponse uploadDocument(MultipartFile file, Long tenantRegulatorId,
                                            String title, String dateIssued) {
        if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
        if (!file.getContentType().contains("pdf"))
            throw new IllegalArgumentException("Only PDF files accepted");

        Integer platformRegulatorId = null;
        if (tenantRegulatorId != null) {
            TenantRegulator reg = tenantRegulators.findByIdAndTenantId(tenantRegulatorId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Regulator not found"));
            if (!Boolean.TRUE.equals(reg.getIsActive()))
                throw new IllegalArgumentException("Regulator is not active");
            platformRegulatorId = reg.getPlatformRegulatorId();
        }

        UUID uploadId = UUID.randomUUID();

        UploadJob job = UploadJob.builder()
            .uploadId(uploadId)
            .tenantId(tenantId)
            .tenantRegulatorId(tenantRegulatorId)
            .title(title != null ? title : file.getOriginalFilename())
            .status("queued")
            .build();
        uploadJobs.save(job);

        IngestResponseDto result = platformClient.ingestDocument(
            file, tenantRegulatorId, tenantId,
            platformRegulatorId, title, dateIssued);

        if (result.getError() != null) {
            job.setStatus("failed");
            job.setErrorMessage(result.getError());
        } else {
            job.setPlatformJobId(result.getUploadId());
            job.setPlatformInstrumentId(result.getInstrumentId());
            job.setStatus(result.getInstrumentId() != null ? "completed" : "processing");
        }
        uploadJobs.save(job);

        return UploadJobResponse.builder()
            .uploadId(uploadId)
            .status(job.getStatus())
            .platformInstrumentId(job.getPlatformInstrumentId())
            .errorMessage(job.getErrorMessage())
            .build();
    }

    public Page<UploadJob> list(Pageable pageable) {
        Page<UploadJob> page = uploadJobs.findByTenantId(tenantId, pageable);
        List<UploadJob> changed = new ArrayList<>();
        for (UploadJob job : page.getContent()) {
            if ("processing".equals(job.getStatus()) && job.getPlatformJobId() != null) {
                IngestResponseDto status = platformClient.getUploadStatus(job.getPlatformJobId());
                if (status.getInstrumentId() != null) {
                    job.setPlatformInstrumentId(status.getInstrumentId());
                    job.setStatus("completed");
                    backfillRegulator(job, status.getInstrumentId());
                    ensurePendingReview(job, status.getInstrumentId());
                    changed.add(job);
                } else if (status.getError() != null) {
                    job.setStatus("failed");
                    job.setErrorMessage(status.getError());
                    changed.add(job);
                }
            }
        }
        if (!changed.isEmpty()) uploadJobs.saveAll(changed);
        return page;
    }

    public UploadReviewResponse getReview(UUID uploadId) {
        UploadJob job = uploadJobs.findByUploadIdAndTenantId(uploadId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Upload not found"));

        Long instrumentId = job.getPlatformInstrumentId();
        if (instrumentId == null && job.getPlatformJobId() != null) {
            IngestResponseDto status = platformClient.getUploadStatus(job.getPlatformJobId());
            if (status.getInstrumentId() != null) {
                job.setPlatformInstrumentId(status.getInstrumentId());
                uploadJobs.save(job);
                instrumentId = status.getInstrumentId();
            }
        }

        if (instrumentId == null) {
            return UploadReviewResponse.builder()
                .uploadId(uploadId).status(job.getStatus()).build();
        }

        backfillRegulator(job, instrumentId);

        PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(instrumentId);
        if (detail == null) {
            return UploadReviewResponse.builder()
                .uploadId(uploadId).status(job.getStatus())
                .platformInstrumentId(instrumentId).build();
        }

        List<UploadReviewResponse.ObligationItem> items = new ArrayList<>();
        if (detail.getObligations() != null) {
            for (var o : detail.getObligations()) {
                items.add(UploadReviewResponse.ObligationItem.builder()
                    .obligationNumber(o.getObligationNumber())
                    .plainEnglishStatement(o.getPlainEnglishStatement())
                    .specificSectionReference(o.getSpecificSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .build());
            }
        }

        return UploadReviewResponse.builder()
            .uploadId(uploadId)
            .platformInstrumentId(instrumentId)
            .status(job.getStatus())
            .regulatorId(detail.getRegulatorId())
            .regulatorName(detail.getRegulatorName())
            .pdfUrl(detail.getPdfUrl())
            .pdfOcrText(detail.getPdfOcrText())
            .aiSummary(detail.getAiSummary())
            .obligations(items)
            .build();
    }

    @Transactional
    public UploadJobResponse confirm(UUID uploadId, ConfirmUploadRequest req) {
        UploadJob job = uploadJobs.findByUploadIdAndTenantId(uploadId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Upload not found"));

        Long instrumentId = job.getPlatformInstrumentId();
        if (instrumentId == null) {
            throw new IllegalStateException("Upload has no instrument yet");
        }

        PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(instrumentId);
        List<ReviewObligation> obligations = new ArrayList<>();
        if (req.getObligations() != null) {
            for (var o : req.getObligations()) {
                obligations.add(ReviewObligation.builder()
                    .obligationNumber(o.getObligationNumber())
                    .description(o.getDescription())
                    .sectionReference(o.getSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .applicable(o.getApplicable() != null ? o.getApplicable() : true)
                    .build());
            }
        }

        PendingReview review = pendingReviews.findByUploadIdAndTenantId(uploadId, tenantId)
            .orElseGet(() -> PendingReview.builder().tenantId(tenantId).source("upload").uploadId(uploadId).build());
        review.setInstrumentId(instrumentId);
        review.setSourceTitle(detail != null ? detail.getSourceTitle() : job.getTitle());
        review.setSourceReferenceNumber(detail != null ? detail.getSourceReferenceNumber() : null);
        review.setRegulatorId(detail != null ? detail.getRegulatorId() : null);
        review.setRegulatorName(detail != null ? detail.getRegulatorName() : null);
        review.setRegulatorAbbreviation(detail != null ? detail.getRegulatorAbbreviation() : null);
        review.setDocumentType(detail != null ? detail.getNature() : null);
        review.setRiskRating(detail != null ? detail.getRiskRating() : null);
        review.setDateIssued(detail != null ? detail.getDateIssued() : null);
        review.setEffectiveDate(detail != null
            ? (detail.getDateCommencement() != null ? detail.getDateCommencement() : detail.getDateIssued()) : null);
        review.setPublishedAt(detail != null ? detail.getPublishedAt() : null);
        review.setPdfUrl(detail != null ? detail.getPdfUrl() : null);
        review.setObligations(obligations);
        review.setStatus("pending");
        pendingReviews.save(review);

        job.setStatus("confirmed");
        uploadJobs.save(job);

        return UploadJobResponse.builder()
            .uploadId(uploadId)
            .status("confirmed")
            .platformInstrumentId(instrumentId)
            .build();
    }

    public UploadJobResponse getUploadStatus(UUID uploadId) {
        UploadJob job = uploadJobs.findByUploadIdAndTenantId(uploadId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Upload not found"));

        if ("processing".equals(job.getStatus()) && job.getPlatformJobId() != null) {
            IngestResponseDto status = platformClient.getUploadStatus(job.getPlatformJobId());
            if (status.getInstrumentId() != null) {
                job.setPlatformInstrumentId(status.getInstrumentId());
                job.setStatus("completed");
                backfillRegulator(job, status.getInstrumentId());
                ensurePendingReview(job, status.getInstrumentId());
            } else if (status.getError() != null) {
                job.setStatus("failed");
                job.setErrorMessage(status.getError());
            }
            uploadJobs.save(job);
        }

        return UploadJobResponse.builder()
            .uploadId(uploadId)
            .status(job.getStatus())
            .platformInstrumentId(job.getPlatformInstrumentId())
            .errorMessage(job.getErrorMessage())
            .build();
    }

    private void backfillRegulator(UploadJob job, Long instrumentId) {
        if (job.getTenantRegulatorId() != null) return;
        PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(instrumentId);
        if (detail == null || detail.getRegulatorId() == null) return;
        tenantRegulators.findByTenantIdAndPlatformRegulatorId(tenantId, detail.getRegulatorId())
            .ifPresent(reg -> {
                job.setTenantRegulatorId(reg.getId());
                log.info("Backfilled regulator {} for upload {}", reg.getId(), job.getUploadId());
            });
    }

    private void ensurePendingReview(UploadJob job, Long instrumentId) {
        if (pendingReviews.findByInstrumentIdAndTenantId(instrumentId, tenantId).isPresent()) return;
        PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(instrumentId);
        List<ReviewObligation> obligations = new ArrayList<>();
        if (detail != null && detail.getObligations() != null) {
            for (var o : detail.getObligations()) {
                obligations.add(ReviewObligation.builder()
                    .obligationNumber(o.getObligationNumber())
                    .description(o.getPlainEnglishStatement())
                    .sectionReference(o.getSpecificSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .applicable(true)
                    .build());
            }
        }
        pendingReviews.save(PendingReview.builder()
            .tenantId(tenantId)
            .source("upload")
            .uploadId(job.getUploadId())
            .instrumentId(instrumentId)
            .sourceTitle(detail != null ? detail.getSourceTitle() : job.getTitle())
            .sourceReferenceNumber(detail != null ? detail.getSourceReferenceNumber() : null)
            .regulatorId(detail != null ? detail.getRegulatorId() : null)
            .regulatorName(detail != null ? detail.getRegulatorName() : null)
            .regulatorAbbreviation(detail != null ? detail.getRegulatorAbbreviation() : null)
            .documentType(detail != null ? detail.getNature() : null)
            .riskRating(detail != null ? detail.getRiskRating() : null)
            .dateIssued(detail != null ? detail.getDateIssued() : null)
            .effectiveDate(detail != null
                ? (detail.getDateCommencement() != null ? detail.getDateCommencement() : detail.getDateIssued()) : null)
            .publishedAt(detail != null ? detail.getPublishedAt() : null)
            .pdfUrl(detail != null ? detail.getPdfUrl() : null)
            .obligations(obligations)
            .status("pending")
            .build());
        log.info("Queued {} obligations for review from upload {} (instrument {})",
            obligations.size(), job.getUploadId(), instrumentId);
    }
}
