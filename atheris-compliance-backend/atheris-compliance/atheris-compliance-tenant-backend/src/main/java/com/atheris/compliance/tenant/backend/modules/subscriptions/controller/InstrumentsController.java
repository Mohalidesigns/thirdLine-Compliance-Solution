package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentDetailResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentSummaryResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.InstrumentsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @GetMapping("/{id}")
    public ResponseEntity<InstrumentDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }
}
