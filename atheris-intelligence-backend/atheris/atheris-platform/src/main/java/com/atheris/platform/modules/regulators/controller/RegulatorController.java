package com.atheris.platform.modules.regulators.controller;

import com.atheris.platform.modules.regulators.dto.*;
import com.atheris.platform.modules.regulators.entity.ScraperRunLog;
import com.atheris.platform.modules.regulators.service.RegulatorService;
import com.atheris.platform.modules.regulators.service.ScraperService;
import com.atheris.platform.modules.regulators.strategy.ScraperRunResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/regulators")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class RegulatorController {

    private final RegulatorService regulatorService;
    private final ScraperService scraperService;

    @GetMapping
    public ResponseEntity<List<RegulatorDto>> listAll(
            @RequestParam(required = false) Boolean activeOnly) {
        return ResponseEntity.ok(regulatorService.findAll(activeOnly));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RegulatorDto> getOne(@PathVariable Integer id) {
        return ResponseEntity.ok(regulatorService.findById(id));
    }

    @PostMapping
    public ResponseEntity<RegulatorDto> create(@Valid @RequestBody CreateRegulatorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(regulatorService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegulatorDto> update(
            @PathVariable Integer id,
            @Valid @RequestBody CreateRegulatorRequest req) {
        return ResponseEntity.ok(regulatorService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Integer id) {
        regulatorService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test-scraper")
    public ResponseEntity<ScraperRunResult> testScraper(
            @PathVariable Integer id,
            @RequestParam(defaultValue = "false") boolean dryRun) {
        return ResponseEntity.ok(regulatorService.testScraper(id, dryRun));
    }

    @GetMapping("/{id}/scraper-history")
    public ResponseEntity<List<ScraperRunLog>> scraperHistory(@PathVariable Integer id) {
        return ResponseEntity.ok(regulatorService.getScraperHistory(id));
    }
}
