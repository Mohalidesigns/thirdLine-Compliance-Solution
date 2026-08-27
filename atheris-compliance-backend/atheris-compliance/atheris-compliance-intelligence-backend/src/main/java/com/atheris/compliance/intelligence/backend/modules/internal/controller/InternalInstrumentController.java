package com.atheris.compliance.intelligence.backend.modules.internal.controller;

import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.internal.service.InternalInstrumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/internal/instruments")
@RequiredArgsConstructor
public class InternalInstrumentController {

    private final InternalInstrumentService service;

    @PostMapping("/batch")
    public ResponseEntity<Map<Long, InternalInstrumentDetail>> batchDetail(@RequestBody List<Long> ids) {
        return ResponseEntity.ok(service.getBatchDetail(ids));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<InternalInstrumentSummary>> search(
            @RequestParam String q,
            @RequestParam(required = false) List<Integer> regulatorIds,
            Pageable pageable) {
        return ResponseEntity.ok(service.searchInstruments(q, regulatorIds, pageable));
    }

    @GetMapping("/recent")
    public ResponseEntity<Page<InternalInstrumentSummary>> recentApplicable(
            @RequestParam Long tenantId,
            @RequestParam List<Integer> regulatorIds,
            @RequestParam String licenceType,
            @RequestParam(required = false) LocalDate since,
            Pageable pageable) {
        return ResponseEntity.ok(service.findRecentForTenant(tenantId, regulatorIds, licenceType, since, pageable));
    }

    @GetMapping("/{instrumentId}/detail")
    public ResponseEntity<InternalInstrumentDetail> detail(@PathVariable Long instrumentId) {
        return ResponseEntity.ok(service.getFullDetail(instrumentId));
    }

    @GetMapping("/{instrumentId}/pdf")
    public ResponseEntity<Resource> pdf(@PathVariable Long instrumentId,
                                        @RequestParam(defaultValue = "false") boolean download) throws IOException {
        InputStreamResource resource = new InputStreamResource(service.openPdfStream(instrumentId));
        String filename = "document-" + instrumentId + ".pdf";
        ContentDisposition disposition = download
                ? ContentDisposition.attachment().filename(filename).build()
                : ContentDisposition.inline().filename(filename).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }
}
