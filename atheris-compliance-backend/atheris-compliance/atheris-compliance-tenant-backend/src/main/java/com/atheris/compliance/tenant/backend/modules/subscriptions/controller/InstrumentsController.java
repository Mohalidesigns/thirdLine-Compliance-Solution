package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentDetailResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentSummaryResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UniverseInstrumentItem;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UniverseStatsResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.InstrumentsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/subscriptions/instruments")
@RequiredArgsConstructor
public class InstrumentsController {

    private final InstrumentsService service;

    @GetMapping
    public ResponseEntity<Page<InstrumentSummaryResponse>> search(
            @RequestParam(defaultValue = "") String q,
            Pageable pageable) {
        return ResponseEntity.ok(service.search(q, pageable));
    }

    @GetMapping("/universe")
    public ResponseEntity<Page<UniverseInstrumentItem>> universe(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String regulator,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) String riskRating,
            @RequestParam(required = false) String nature,
            @RequestParam(required = false) String status,
            Pageable pageable) {
        return ResponseEntity.ok(service.universeInstruments(q, regulator, areaOfFocus, riskRating, nature, status, pageable));
    }

    @GetMapping("/universe-stats")
    public ResponseEntity<UniverseStatsResponse> universeStats() {
        return ResponseEntity.ok(service.universeStats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstrumentDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id,
                                      @RequestParam(defaultValue = "false") boolean download) {
        byte[] bytes = service.pdfBytes(id);
        String filename = "document-" + id + ".pdf";
        ContentDisposition disposition = download
                ? ContentDisposition.attachment().filename(filename).build()
                : ContentDisposition.inline().filename(filename).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(bytes);
    }
}
