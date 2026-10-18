package com.atheris.compliance.tenant.backend.modules.returns.controller;

import com.atheris.compliance.tenant.backend.modules.returns.dto.PublicReturnUploadView;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnUploadLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Map;

/**
 * Public, unauthenticated endpoints for the return event-filing upload page. Reachable without a
 * login (permitted in SecurityConfig); the token in the path is the only credential.
 */
@RestController
@RequestMapping("/api/v1/public/returns")
@RequiredArgsConstructor
public class PublicReturnUploadController {

    private final ReturnUploadLinkService service;

    @GetMapping("/{token}")
    public ResponseEntity<PublicReturnUploadView> view(@PathVariable String token) {
        return ResponseEntity.ok(service.view(token));
    }

    @PostMapping(value = "/{token}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String token,
            @RequestParam(value = "triggerDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate triggerDate,
            @RequestParam(value = "reference", required = false) String reference,
            @RequestParam(value = "dueDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueDate,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        service.submit(token, triggerDate, reference, dueDate, file);
        return ResponseEntity.ok(Map.of("status", "recorded"));
    }
}
