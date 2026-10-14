package com.atheris.compliance.tenant.backend.modules.remediation.controller;

import com.atheris.compliance.tenant.backend.modules.remediation.dto.PublicRemediationView;
import com.atheris.compliance.tenant.backend.modules.remediation.service.RemediationLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Public, unauthenticated endpoints for the owner remediation page. Reachable without a
 * login (permitted in SecurityConfig); the token in the path is the only credential.
 */
@RestController
@RequestMapping("/api/v1/public/remediation")
@RequiredArgsConstructor
public class PublicRemediationController {

    private final RemediationLinkService service;

    @GetMapping("/{token}")
    public ResponseEntity<PublicRemediationView> view(@PathVariable String token) {
        return ResponseEntity.ok(service.view(token));
    }

    @PostMapping(value = "/{token}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String token,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) throws Exception {
        service.submit(token, notes, files);
        return ResponseEntity.ok(Map.of("status", "submitted"));
    }
}