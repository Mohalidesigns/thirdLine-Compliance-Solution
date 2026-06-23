package com.atheris.platform.modules.jobs.controller;

import com.atheris.platform.modules.instruments.dto.InstrumentDto;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.jobs.dto.JobDetailDto;
import com.atheris.platform.modules.jobs.dto.JobQueueDto;
import com.atheris.platform.modules.jobs.dto.JobQueueStatsDto;
import com.atheris.platform.modules.jobs.entity.JobQueue;
import com.atheris.platform.modules.jobs.repository.JobQueueRepository;
import com.atheris.platform.shared.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/jobs")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminJobQueueController {

    private final JobQueueRepository repo;
    private final InstrumentRepository instruments;
    private final StorageService storage;

    @GetMapping
    public ResponseEntity<Page<JobQueueDto>> list(
            @RequestParam(required = false) String jobType,
            @RequestParam(required = false) String status,
            Pageable pageable) {
        return ResponseEntity.ok(
            repo.listJobs(jobType, status, pageable).map(this::toDto)
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobDetailDto> getOne(@PathVariable Long id) {
        JobQueue job = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Job not found: " + id));

        InstrumentDto instrument = null;
        if (job.getSubjectId() != null) {
            instrument = instruments.findById(job.getSubjectId())
                .map(i -> InstrumentDto.builder()
                    .instrumentId(i.getInstrumentId())
                    .regulatorId(i.getRegulatorId())
                    .sourceTitle(i.getSourceTitle())
                    .areaOfFocus(i.getAreaOfFocus())
                    .nature(i.getNature())
                    .riskRating(i.getRiskRating())
                    .applicabilityConfidence(i.getApplicabilityConfidence())
                    .aiSummary(i.getAiSummary())
                    .licenceTypesApplicable(i.getLicenceTypesApplicable())
                    .dateIssued(i.getDateIssued())
                    .dateCommencement(i.getDateCommencement())
                    .status(i.getStatus())
                    .discoveredAt(i.getDiscoveredAt())
                    .firstPublishedAt(i.getFirstPublishedAt())
                    .build())
                .orElse(null);
        }

        return ResponseEntity.ok(JobDetailDto.builder()
            .jobId(job.getJobId())
            .jobType(job.getJobType())
            .subjectId(job.getSubjectId())
            .status(job.getStatus())
            .priority(job.getPriority())
            .attemptCount(job.getAttemptCount())
            .maxAttempts(job.getMaxAttempts())
            .lastError(job.getLastError())
            .nextRetryAt(job.getNextRetryAt())
            .startedAt(job.getStartedAt())
            .completedAt(job.getCompletedAt())
            .createdByService(job.getCreatedByService())
            .createdAt(job.getCreatedAt())
            .updatedAt(job.getUpdatedAt())
            .payload(job.getPayload())
            .instrument(instrument)
            .build());
    }

    @GetMapping("/stats")
    public ResponseEntity<JobQueueStatsDto> stats() {
        long pending = repo.countByStatus("pending");
        long processing = repo.countByStatus("processing");
        long completed = repo.countByStatus("completed");
        long failed = repo.countByStatus("failed");

        Map<String, Map<String, Long>> perType = new HashMap<>();
        for (Object[] row : repo.countByTypeAndStatus()) {
            String type = (String) row[0];
            String st = (String) row[1];
            Long cnt = (Long) row[2];
            perType.computeIfAbsent(type, k -> new HashMap<>()).put(st, cnt);
        }

        return ResponseEntity.ok(JobQueueStatsDto.builder()
            .totalPending(pending)
            .totalProcessing(processing)
            .totalCompleted(completed)
            .totalFailed(failed)
            .perType(perType)
            .build());
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Map<String, String>> getPdfUrl(@PathVariable Long id) {
        JobQueue job = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Job not found: " + id));

        Map<String, Object> payload = job.getPayload();
        String s3Key = null;

        if (payload != null && payload.containsKey("pdf_s3_url")) {
            s3Key = (String) payload.get("pdf_s3_url");
        }

        // Fall back to instrument's pdfUrl if subject is linked
        if (s3Key == null && job.getSubjectId() != null) {
            s3Key = instruments.findById(job.getSubjectId())
                .map(i -> i.getPdfUrl())
                .orElse(null);
        }

        if (s3Key == null) {
            return ResponseEntity.ok(Map.of("error", "No PDF available for this job"));
        }

        String presignedUrl = storage.generatePresignedUrl(s3Key, 3600);
        return ResponseEntity.ok(Map.of("pdfUrl", presignedUrl));
    }

    private JobQueueDto toDto(JobQueue j) {
        return JobQueueDto.builder()
            .jobId(j.getJobId())
            .jobType(j.getJobType())
            .subjectId(j.getSubjectId())
            .status(j.getStatus())
            .priority(j.getPriority())
            .attemptCount(j.getAttemptCount())
            .maxAttempts(j.getMaxAttempts())
            .lastError(j.getLastError())
            .nextRetryAt(j.getNextRetryAt())
            .startedAt(j.getStartedAt())
            .completedAt(j.getCompletedAt())
            .createdByService(j.getCreatedByService())
            .createdAt(j.getCreatedAt())
            .updatedAt(j.getUpdatedAt())
            .payload(j.getPayload())
            .build();
    }
}
