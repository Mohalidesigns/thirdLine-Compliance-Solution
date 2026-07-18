package com.atheris.compliance.intelligence.backend.modules.internal.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalIngestResponse;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.jobs.service.JobQueueService;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.intelligence.backend.shared.ocr.PdfExtractionService;
import com.atheris.compliance.intelligence.backend.shared.storage.StorageService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class InternalInstrumentService {

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final PdfExtractionService pdfExtractor;
    private final StorageService storage;
    private final JobQueueService jobQueue;

    @Value("${atheris.storage.max-pdf-size-mb:50}")
    private int maxPdfSizeMb;

    @Transactional
    public InternalIngestResponse ingest(MultipartFile file, Long tenantRegulatorId, Long tenantId,
                                          Integer platformRegulatorId, String title, String dateIssued) {
        try {
            if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
            if (!file.getContentType().contains("pdf"))
                throw new IllegalArgumentException("Only PDF files accepted");
            if (file.getSize() > (long) maxPdfSizeMb * 1024 * 1024)
                throw new IllegalArgumentException("File exceeds " + maxPdfSizeMb + "MB limit");

            byte[] pdfBytes = file.getBytes();
            String hash = HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(pdfBytes));

            var existing = instruments.findByPdfHash(hash);
            if (existing.isPresent()) {
                Instrument inst = existing.get();
                return InternalIngestResponse.builder()
                    .instrumentId(inst.getInstrumentId())
                    .status(inst.getStatus())
                    .duplicate(true)
                    .message("Document already exists")
                    .build();
            }

            String text = pdfExtractor.extractText(pdfBytes);
            String s3Key = Constants.S3_KEY_INSTRUMENTS_PREFIX + hash + ".pdf";
            storage.upload(pdfBytes, s3Key, Constants.MIME_PDF);

            Integer regId = platformRegulatorId != null ? platformRegulatorId : 0;

            Instrument inst = Instrument.builder()
                .regulatorId(regId)
                .sourceTitle(title != null ? title : extractTitleFromText(text))
                .pdfUrl(s3Key).pdfHash(hash).pdfOcrText(text)
                .dateIssued(dateIssued != null ? LocalDate.parse(dateIssued) : null)
                .status(Constants.INST_TRIAGE).uploadSource("manual_upload")
                .build();
            instruments.save(inst);

            Long jobId = jobQueue.enqueue(Constants.JOB_CLASSIFY, inst.getInstrumentId(),
                1, Map.of("ocr_text", text, "instrument_id", inst.getInstrumentId(),
                    "instrument_title", inst.getSourceTitle(), "regulator_id", regId),
                "tenant-upload");

            return InternalIngestResponse.builder()
                .instrumentId(inst.getInstrumentId())
                .jobId(jobId)
                .status(Constants.INST_TRIAGE)
                .duplicate(false)
                .message("Document queued for processing")
                .build();

        } catch (Exception e) {
            throw new RuntimeException("Ingest failed: " + e.getMessage(), e);
        }
    }

    public Page<InternalInstrumentSummary> findRecentForTenant(Long tenantId, List<Integer> regulatorIds,
                                                                String licenceType, LocalDate since, Pageable pageable) {
        if (regulatorIds.isEmpty()) return Page.empty();

        Specification<Instrument> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), Constants.INST_PUBLISHED));
            predicates.add(root.get("regulatorId").in(regulatorIds));
            if (since != null)
                predicates.add(cb.greaterThan(root.get("publishedAt"), since));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Instrument> page = instruments.findAll(spec, pageable);
        List<InternalInstrumentSummary> filtered = page.getContent().stream()
            .filter(i -> i.getLicenceTypesApplicable() == null
                || i.getLicenceTypesApplicable().isEmpty()
                || i.getLicenceTypesApplicable().contains(licenceType))
            .map(this::toSummary)
            .toList();

        return new PageImpl<>(filtered, pageable, page.getTotalElements());
    }

    public InternalInstrumentDetail getFullDetail(Long instrumentId) {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + instrumentId));

        return InternalInstrumentDetail.builder()
            .instrumentId(inst.getInstrumentId())
            .sourceTitle(inst.getSourceTitle())
            .sourceReferenceNumber(inst.getSourceReferenceNumber())
            .regulatorId(inst.getRegulatorId())
            .dateIssued(inst.getDateIssued())
            .dateCommencement(inst.getDateCommencement())
            .riskRating(inst.getRiskRating())
            .nature(inst.getNature())
            .areaOfFocus(inst.getAreaOfFocus())
            .aiSummary(inst.getAiSummary())
            .pdfUrl(storage.generatePresignedUrl(inst.getPdfUrl(), 3600))
            .pdfOcrText(inst.getPdfOcrText())
            .publishedAt(inst.getPublishedAt())
            .status(inst.getStatus())
            .obligations(obligations.findByInstrumentId(instrumentId).stream()
                .map(o -> InternalInstrumentDetail.ObligationItem.builder()
                    .obligationNumber(o.getObligationNumber())
                    .plainEnglishStatement(o.getPlainEnglishStatement())
                    .specificSectionReference(o.getSpecificSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .build())
                .toList())
            .sanctions(sanctions.findByInstrumentId(instrumentId).stream()
                .map(s -> InternalInstrumentDetail.SanctionItem.builder()
                    .sanctionType(s.getSanctionType())
                    .amountNaira(s.getSanctionAmountNaira())
                    .liableRoles(s.getLiableRoles())
                    .severityScore(s.getSeverityScore())
                    .hasBeenEnforced(s.getHasBeenEnforced())
                    .build())
                .toList())
            .build();
    }

    private String extractTitleFromText(String text) {
        if (text == null || text.isBlank()) return "Untitled";
        String[] lines = text.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (!line.isBlank() && line.length() > 10 && line.length() < 200) return line;
        }
        return "Untitled";
    }

    private InternalInstrumentSummary toSummary(Instrument i) {
        return InternalInstrumentSummary.builder()
            .instrumentId(i.getInstrumentId())
            .sourceTitle(i.getSourceTitle())
            .sourceReferenceNumber(i.getSourceReferenceNumber())
            .regulatorId(i.getRegulatorId())
            .dateIssued(i.getDateIssued())
            .riskRating(i.getRiskRating())
            .nature(i.getNature())
            .areaOfFocus(i.getAreaOfFocus())
            .aiSummary(i.getAiSummary())
            .publishedAt(i.getPublishedAt())
            .pdfUrl(storage.generatePresignedUrl(i.getPdfUrl(), 3600))
            .build();
    }
}
