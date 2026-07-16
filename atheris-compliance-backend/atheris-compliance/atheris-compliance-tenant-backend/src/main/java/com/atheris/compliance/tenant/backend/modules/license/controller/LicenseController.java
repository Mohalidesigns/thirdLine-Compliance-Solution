package com.atheris.compliance.tenant.backend.modules.license.controller;

import com.atheris.compliance.tenant.backend.modules.license.dto.*;
import com.atheris.compliance.tenant.backend.modules.license.service.LicenseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/license")
@RequiredArgsConstructor
public class LicenseController {

    private final LicenseService service;

    @PostMapping("/activate")
    public ResponseEntity<LicenseStatusResponse> activate(
            @Valid @RequestBody ActivateLicenseRequest req,
            HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        String ua = request.getHeader("User-Agent");
        return ResponseEntity.ok(service.activate(req, ip, ua));
    }

    @GetMapping("/status")
    public ResponseEntity<LicenseStatusResponse> getStatus() {
        return ResponseEntity.ok(service.getStatus());
    }

    @PostMapping("/checkup")
    public ResponseEntity<LicenseStatusResponse> checkup() {
        return ResponseEntity.ok(service.checkup());
    }

    @PostMapping("/deactivate")
    public ResponseEntity<Map<String, String>> deactivate() {
        service.deactivate();
        return ResponseEntity.ok(Map.of("message", "License deactivated"));
    }

    @GetMapping("/audit")
    public ResponseEntity<List<LicenseAuditEntryDto>> getAudit() {
        return ResponseEntity.ok(service.getAuditLog());
    }
}
