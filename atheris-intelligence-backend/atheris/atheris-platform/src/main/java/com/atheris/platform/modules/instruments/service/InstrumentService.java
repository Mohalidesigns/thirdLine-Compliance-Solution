package com.atheris.platform.modules.instruments.service;

import com.atheris.common.Constants;
import com.atheris.platform.modules.classification.service.ClassificationService;
import com.atheris.platform.modules.instruments.dto.*;
import com.atheris.platform.modules.instruments.entity.Instrument;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.jobs.service.JobQueueService;
import com.atheris.platform.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.platform.modules.sanctions.repository.SanctionsRepository;
import com.atheris.platform.shared.ocr.PdfExtractionService;
import com.atheris.platform.shared.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service @Slf4j @RequiredArgsConstructor
public class InstrumentService {

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final PdfExtractionService pdfExtractor;
    private final StorageService storage;
    private final JobQueueService jobQueue;
    private final ClassificationService classifier;

    @Value("${atheris.storage.max-pdf-size-mb:50}")
    private int maxPdfSizeMb;

    public Page<InstrumentDto> search(Integer regulatorId, String riskRating,
                                       String status, Pageable pageable) {
        return instruments.search(regulatorId, riskRating, pageable).map(this::toDto);
    }

    public InstrumentDetailDto findById(Long id) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + id));
        return toDetailDto(inst);
    }

    @Transactional
    public UploadResponse uploadDocument(MultipartFile file, Integer regulatorId,
                                          String title, String dateIssued, boolean forceOcr) {
        try {
            if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
            if (!file.getContentType().contains("pdf"))
                throw new IllegalArgumentException("Only PDF files accepted");
            if (file.getSize() > (long) maxPdfSizeMb * 1024 * 1024)
                throw new IllegalArgumentException("File exceeds " + maxPdfSizeMb + "MB limit");

            byte[] pdfBytes = file.getBytes();
            String hash = HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(pdfBytes));

            // Duplicate check
            var existing = instruments.findByPdfHash(hash);
            if (existing.isPresent())
                return UploadResponse.builder().instrumentId(existing.get().getInstrumentId())
                    .status(existing.get().getStatus()).duplicate(true)
                    .message("Document already exists").build();

            // Extract text
            String text = forceOcr
                ? pdfExtractor.extractWithTesseract(pdfBytes)
                : pdfExtractor.extractText(pdfBytes);

            // Upload to S3
            String s3Key = Constants.S3_KEY_INSTRUMENTS_PREFIX + hash + ".pdf";
            storage.upload(pdfBytes, s3Key, Constants.MIME_PDF);

            // Save instrument
            Instrument inst = Instrument.builder()
                .regulatorId(regulatorId)
                .sourceTitle(title != null ? title : extractTitleFromText(text))
                .pdfUrl(s3Key).pdfHash(hash).pdfOcrText(text)
                .dateIssued(dateIssued != null ? LocalDate.parse(dateIssued) : null)
                .status(Constants.INST_TRIAGE).uploadSource("manual_upload").build();
            instruments.save(inst);

            // Queue classification
            Long jobId = jobQueue.enqueue(Constants.JOB_CLASSIFY, inst.getInstrumentId(),
                1, Map.of("ocr_text", text, "instrument_id", inst.getInstrumentId()),
                "document-upload");

            return UploadResponse.builder()
                .instrumentId(inst.getInstrumentId()).status(Constants.INST_TRIAGE)
                .extractedTextPreview(text.substring(0, Math.min(500, text.length())))
                .textLength(text.length()).jobId(jobId)
                .message("Document uploaded. AI classification queued.")
                .build();

        } catch (Exception e) {
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }

    public Object classifyNow(Long id) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + id));
        return classifier.classifySync(id, inst.getPdfOcrText());
    }

    @Transactional
    public InstrumentDto publish(Long id) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + id));
        inst.setStatus(Constants.INST_PUBLISHED);
        return toDto(instruments.save(inst));
    }

    @Transactional
    public InstrumentDto update(Long id, UpdateInstrumentRequest req) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + id));
        if (req.getAreaOfFocus() != null) inst.setAreaOfFocus(req.getAreaOfFocus());
        if (req.getNature() != null) inst.setNature(req.getNature());
        if (req.getRiskRating() != null) inst.setRiskRating(req.getRiskRating());
        if (req.getLicenceTypesApplicable() != null) inst.setLicenceTypesApplicable(req.getLicenceTypesApplicable());
        if (req.getAiSummary() != null) inst.setAiSummary(req.getAiSummary());
        if (req.getStatus() != null) inst.setStatus(req.getStatus());
        return toDto(instruments.save(inst));
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

    private InstrumentDto toDto(Instrument i) {
        return InstrumentDto.builder()
            .instrumentId(i.getInstrumentId()).regulatorId(i.getRegulatorId())
            .sourceTitle(i.getSourceTitle()).areaOfFocus(i.getAreaOfFocus())
            .nature(i.getNature()).riskRating(i.getRiskRating())
            .applicabilityConfidence(i.getApplicabilityConfidence())
            .aiSummary(i.getAiSummary()).licenceTypesApplicable(i.getLicenceTypesApplicable())
            .dateIssued(i.getDateIssued()).dateCommencement(i.getDateCommencement())
            .status(i.getStatus()).discoveredAt(i.getDiscoveredAt())
            .firstPublishedAt(i.getFirstPublishedAt()).build();
    }

    private InstrumentDetailDto toDetailDto(Instrument i) {
        var oblDtos = obligations.findByInstrumentId(i.getInstrumentId()).stream()
            .map(o -> InstrumentDetailDto.ObligationDto.builder()
                .number(o.getObligationNumber()).statement(o.getPlainEnglishStatement())
                .sectionReference(o.getSpecificSectionReference())
                .type(o.getObligationType()).recurringDeadline(o.getRecurringDeadlineType())
                .build()).toList();

        var sanDtos = sanctions.findByInstrumentId(i.getInstrumentId()).stream()
            .map(s -> InstrumentDetailDto.SanctionDto.builder()
                .sanctionType(s.getSanctionType()).amountNaira(s.getSanctionAmountNaira())
                .liableRoles(s.getLiableRoles()).severityScore(s.getSeverityScore())
                .hasBeenEnforced(s.getHasBeenEnforced()).build()).toList();

        return InstrumentDetailDto.builder()
            .instrumentId(i.getInstrumentId()).sourceTitle(i.getSourceTitle())
            .areaOfFocus(i.getAreaOfFocus()).nature(i.getNature()).riskRating(i.getRiskRating())
            .applicabilityConfidence(i.getApplicabilityConfidence()).aiSummary(i.getAiSummary())
            .licenceTypesApplicable(i.getLicenceTypesApplicable())
            .dateIssued(i.getDateIssued()).dateCommencement(i.getDateCommencement())
            .status(i.getStatus()).pdfUrl(i.getPdfUrl()).sourceUrl(i.getSourceUrl())
            .pdfOcrText(i.getPdfOcrText())
            .discoveredAt(i.getDiscoveredAt()).obligations(oblDtos).sanctions(sanDtos).build();
    }
}
