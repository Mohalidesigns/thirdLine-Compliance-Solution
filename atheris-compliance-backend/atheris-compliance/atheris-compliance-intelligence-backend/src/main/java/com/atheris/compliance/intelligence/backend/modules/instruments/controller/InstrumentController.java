package com.atheris.compliance.intelligence.backend.modules.instruments.controller;

import com.atheris.compliance.intelligence.backend.modules.instruments.dto.*;
import com.atheris.compliance.intelligence.backend.modules.instruments.service.InstrumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/platform/instruments")
@RequiredArgsConstructor
public class InstrumentController {

    private final InstrumentService service;

    @GetMapping
    public ResponseEntity<Page<InstrumentDto>> search(
            @RequestParam(required = false) Integer regulatorId,
            @RequestParam(required = false) String riskRating,
            @RequestParam(required = false) String status,
            Pageable pageable) {
        return ResponseEntity.ok(service.search(regulatorId, riskRating, status, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstrumentDetailDto> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public ResponseEntity<UploadResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("regulator_id") Integer regulatorId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "date_issued", required = false) String dateIssued,
            @RequestParam(value = "force_ocr", defaultValue = "false") boolean forceOcr) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.uploadDocument(file, regulatorId, title, dateIssued, forceOcr));
    }

    @PostMapping("/{id}/classify-now")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public ResponseEntity<?> classifyNow(@PathVariable Long id) {
        return ResponseEntity.ok(service.classifyNow(id));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public ResponseEntity<InstrumentDto> publish(@PathVariable Long id) {
        return ResponseEntity.ok(service.publish(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public ResponseEntity<InstrumentDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateInstrumentRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }
}
