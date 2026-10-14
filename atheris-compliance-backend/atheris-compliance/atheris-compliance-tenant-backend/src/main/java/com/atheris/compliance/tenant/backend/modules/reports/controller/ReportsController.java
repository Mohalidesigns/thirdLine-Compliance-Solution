package com.atheris.compliance.tenant.backend.modules.reports.controller;

import com.atheris.compliance.tenant.backend.modules.reports.dto.*;
import com.atheris.compliance.tenant.backend.modules.reports.service.ReportsService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Board pack reports. Generation is limited to CCO and TENANT_ADMIN; sign-off is CCO-only.
 */
@RestController
@RequestMapping("/api/v1/reports/board-packs")
@RequiredArgsConstructor
public class ReportsController {

    private final ReportsService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.AUDITOR + "')")
    public ResponseEntity<Page<BoardPackDto>> list(Pageable p) {
        return ResponseEntity.ok(service.list(p));
    }

    @GetMapping("/preview")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.AUDITOR + "')")
    public ResponseEntity<BoardPackPreviewDto> preview(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> sections) {
        return ResponseEntity.ok(service.preview(from, to, sections));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.AUDITOR + "')")
    public ResponseEntity<BoardPackDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.AUDITOR + "')")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        byte[] pdf = service.download(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + service.fileNameFor(id) + "\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(pdf);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<BoardPackDto> generate(
            @Valid @RequestBody GenerateBoardPackRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.generate(req, u));
    }

    @PostMapping("/{id}/sign-off")
    @PreAuthorize("hasRole('" + AppRole.CCO + "')")
    public ResponseEntity<BoardPackDto> signOff(
            @PathVariable Long id,
            @RequestBody(required = false) SignOffRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.signOff(id, req, u));
    }
}