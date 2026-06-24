package com.atheris.platform.modules.browser.controller;

import com.atheris.platform.modules.browser.dto.*;
import com.atheris.platform.modules.browser.service.ObligationBrowserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/intelligence")
@RequiredArgsConstructor
public class ObligationBrowserController {

    private final ObligationBrowserService service;

    // ── Obligation Library ──────────────────────────────────────────

    @GetMapping("/obligations")
    public ResponseEntity<Page<ObligationSummaryDto>> search(
            ObligationSearchRequest req,
            @AuthenticationPrincipal String tenantId,
            Pageable pageable) {
        req.setTenantId(tenantId);
        return ResponseEntity.ok(service.search(req, pageable));
    }

    @GetMapping("/obligations/{id}")
    public ResponseEntity<ObligationDetailDto> getOne(
            @PathVariable Long id,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.findById(id, tenantId));
    }

    @GetMapping("/obligations/{id}/pdf")
    public ResponseEntity<Resource> streamPdf(@PathVariable Long id) throws IOException {
        InputStreamResource resource = new InputStreamResource(service.openPdfStream(id));
        String filename = "document-" + id + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header("Content-Disposition", "inline; filename=\"" + filename + "\"")
                .body(resource);
    }

    // ── Obligation Inbox (received, pending classification) ─────────

    @GetMapping("/inbox")
    public ResponseEntity<Page<ObligationSummaryDto>> getInbox(
            @AuthenticationPrincipal String tenantId,
            @RequestParam(required = false) String status,
            // status: unclassified | applicable | not_applicable | under_review
            Pageable pageable) {
        return ResponseEntity.ok(service.getInbox(tenantId, status, pageable));
    }

    // ── Classification (Mark applicable / not applicable) ───────────

    @PostMapping("/obligations/{id}/classify")
    public ResponseEntity<ClassifyResponse> classify(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyRequest req,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.classify(id, tenantId, req, null));
    }

    @PutMapping("/obligations/{id}/classify")
    public ResponseEntity<ClassifyResponse> updateClassification(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyRequest req,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.classify(id, tenantId, req, null));
    }

    @GetMapping("/obligations/{id}/classification")
    public ResponseEntity<?> getClassification(
            @PathVariable Long id,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.getClassification(id, tenantId));
    }

    // ── Watch Management ────────────────────────────────────────────

    @GetMapping("/watches")
    public ResponseEntity<?> getWatched(@AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.getWatched(tenantId));
    }

    @DeleteMapping("/watches/{instrumentId}")
    public ResponseEntity<Void> removeWatch(
            @PathVariable Long instrumentId,
            @AuthenticationPrincipal String tenantId) {
        service.removeClassification(instrumentId, tenantId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/watches/{instrumentId}/preferences")
    public ResponseEntity<?> updateWatchPreferences(
            @PathVariable Long instrumentId,
            @RequestBody WatchPreferencesRequest req,
            @AuthenticationPrincipal String tenantId) {
        return ResponseEntity.ok(service.updateWatchPreferences(instrumentId, tenantId, req));
    }

    // ── Export ──────────────────────────────────────────────────────

    @GetMapping("/obligations/export")
    public ResponseEntity<?> export(
            ObligationSearchRequest req,
            @RequestParam(defaultValue = "csv") String format,
            @AuthenticationPrincipal String tenantId) {
        req.setTenantId(tenantId);
        // format: csv | xlsx
        // Returns file download
        return ResponseEntity.ok(service.export(req, format));
    }
}
