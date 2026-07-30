package com.atheris.compliance.intelligence.backend.modules.uploads.controller;

import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import com.atheris.compliance.intelligence.backend.modules.uploads.service.UploadIngestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/internal/uploads")
public class InternalUploadController {

    private final UploadIngestionService ingestion;
    private final UploadRecordRepository repo;

    public InternalUploadController(UploadIngestionService ingestion, UploadRecordRepository repo) {
        this.ingestion = ingestion;
        this.repo = repo;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "regulatorId", required = false) Integer regulatorId,
            @RequestParam(value = "documentType", required = false) String documentType,
            @RequestParam(value = "tenantId", required = false) Integer tenantId,
            @RequestParam(value = "userId", required = false) Integer userId) {

        if (title == null || title.isBlank()) {
            String name = file.getOriginalFilename();
            title = (name != null) ? name.replaceAll("(?i)\\.pdf$", "") : "Untitled";
        }
        UploadRecord record = ingestion.ingest(file, title, regulatorId, documentType, userId, tenantId);
        return ResponseEntity.ok(toResponse(record));
    }

    @GetMapping("/{tenantId}")
    public List<Map<String, Object>> listByTenant(@PathVariable Integer tenantId) {
        return repo.findAllByOrderByCreatedAtDesc().stream()
                .filter(r -> tenantId.equals(r.getTenantId()))
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/record/{uploadId}")
    public ResponseEntity<Map<String, Object>> getByUploadId(@PathVariable Long uploadId) {
        return repo.findById(uploadId)
                .map(r -> ResponseEntity.ok(toResponse(r)))
                .orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> toResponse(UploadRecord r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("originalFilename", r.getOriginalFilename());
        m.put("title", r.getTitle());
        m.put("regulatorId", r.getRegulatorId());
        m.put("documentType", r.getDocumentType());
        m.put("status", r.getStatus().name().toLowerCase());
        m.put("instrumentId", r.getInstrumentId());
        m.put("errorMessage", r.getErrorMessage());
        m.put("createdAt", r.getCreatedAt());
        m.put("updatedAt", r.getUpdatedAt());
        return m;
    }
}
