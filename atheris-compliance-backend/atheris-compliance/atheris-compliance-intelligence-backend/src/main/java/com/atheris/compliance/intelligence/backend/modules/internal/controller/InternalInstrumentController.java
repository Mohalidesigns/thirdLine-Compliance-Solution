package com.atheris.compliance.intelligence.backend.modules.internal.controller;

import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalIngestResponse;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.internal.service.InternalInstrumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

    @PostMapping(value = "/ingest", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<InternalIngestResponse> ingest(
            @RequestParam("file") MultipartFile file,
            @RequestParam("tenant_regulator_id") Long tenantRegulatorId,
            @RequestParam("tenant_id") Long tenantId,
            @RequestParam(value = "platform_regulator_id", required = false) Integer platformRegulatorId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "date_issued", required = false) String dateIssued) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(service.ingest(file, tenantRegulatorId, tenantId, platformRegulatorId, title, dateIssued));
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
