package com.atheris.compliance.intelligence.backend.modules.uploads.controller;

import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import com.atheris.compliance.intelligence.backend.modules.uploads.service.UploadIngestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/uploads")
public class AdminUploadController {

    private final UploadIngestionService ingestion;
    private final UploadRecordRepository repo;

    public AdminUploadController(UploadIngestionService ingestion, UploadRecordRepository repo) {
        this.ingestion = ingestion;
        this.repo = repo;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "regulatorId", required = false) Integer regulatorId,
            @RequestParam(value = "documentType", required = false) String documentType) {

        if (title == null || title.isBlank()) {
            String name = file.getOriginalFilename();
            title = (name != null) ? name.replaceAll("(?i)\\.pdf$", "") : "Untitled";
        }
        UploadRecord record = ingestion.ingest(file, title, regulatorId, documentType, null, null);
        return ResponseEntity.ok(toResponse(record));
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "status", required = false) String statusParam) {
        List<UploadRecord> records;
        if (statusParam != null && !statusParam.isBlank()) {
            UploadStatus s = UploadStatus.valueOf(statusParam.toUpperCase());
            records = repo.findByStatusOrderByCreatedAtDesc(s);
        } else {
            records = repo.findAllByOrderByCreatedAtDesc();
        }
        return records.stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(r -> ResponseEntity.ok(toResponse(r)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> stats() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (UploadStatus s : UploadStatus.values()) {
            counts.put(s.name().toLowerCase(), repo.countByStatus(s));
        }
        return ResponseEntity.ok(counts);
    }

    private Map<String, Object> toResponse(UploadRecord r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("originalFilename", r.getOriginalFilename());
        m.put("title", r.getTitle());
        m.put("regulatorId", r.getRegulatorId());
        m.put("documentType", r.getDocumentType());
        m.put("sha256Hash", r.getSha256Hash());
        m.put("status", r.getStatus().name().toLowerCase());
        m.put("instrumentId", r.getInstrumentId());
        m.put("errorMessage", r.getErrorMessage());
        m.put("createdAt", r.getCreatedAt());
        m.put("updatedAt", r.getUpdatedAt());
        return m;
    }
}
