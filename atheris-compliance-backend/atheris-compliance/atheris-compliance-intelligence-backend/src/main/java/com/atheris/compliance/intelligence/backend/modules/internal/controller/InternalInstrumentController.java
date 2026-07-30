package com.atheris.compliance.intelligence.backend.modules.internal.controller;

import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.internal.service.InternalInstrumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/internal/instruments")
@RequiredArgsConstructor
public class InternalInstrumentController {

    private final InternalInstrumentService service;

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
}
