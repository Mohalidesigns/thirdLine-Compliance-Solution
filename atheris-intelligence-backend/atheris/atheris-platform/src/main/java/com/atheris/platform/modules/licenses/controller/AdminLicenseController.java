package com.atheris.platform.modules.licenses.controller;

import com.atheris.platform.modules.licenses.dto.*;
import com.atheris.platform.modules.licenses.service.LicenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/licenses")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminLicenseController {

    private final LicenseService service;

    @GetMapping
    public ResponseEntity<Page<LicenseDto>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String search,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(status, tenantId, search, pageable));
    }

    @PostMapping
    public ResponseEntity<LicenseDto> create(@Valid @RequestBody CreateLicenseRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LicenseDto> getOne(@PathVariable Integer id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LicenseDto> update(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateLicenseRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<Map<String, String>> revoke(@PathVariable Integer id) {
        service.revoke(id);
        return ResponseEntity.ok(Map.of("message", "License revoked"));
    }

    @PostMapping("/{id}/renew")
    public ResponseEntity<LicenseDto> renew(
            @PathVariable Integer id,
            @Valid @RequestBody RenewLicenseRequest req) {
        return ResponseEntity.ok(service.renew(id, req.getExpiresAt(), req.getGracePeriodDays()));
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidateLicenseResponse> validate(
            @Valid @RequestBody ValidateLicenseRequest req) {
        return ResponseEntity.ok(service.validate(req));
    }

    @DeleteMapping("/{licenseId}/devices/{deviceId}")
    public ResponseEntity<Map<String, String>> removeDevice(
            @PathVariable Integer licenseId,
            @PathVariable Integer deviceId) {
        service.removeDevice(licenseId, deviceId);
        return ResponseEntity.ok(Map.of("message", "Device removed"));
    }

    @GetMapping("/stats")
    public ResponseEntity<LicenseStatsDto> stats() {
        return ResponseEntity.ok(service.getStats());
    }
}
