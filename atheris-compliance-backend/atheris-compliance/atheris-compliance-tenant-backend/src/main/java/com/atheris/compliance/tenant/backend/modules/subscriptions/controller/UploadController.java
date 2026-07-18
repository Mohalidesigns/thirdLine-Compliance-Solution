package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UploadJobResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/subscriptions")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService service;

    @PostMapping(value = "/upload-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<UploadJobResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("tenant_regulator_id") Long tenantRegulatorId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "date_issued", required = false) String dateIssued) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(service.uploadDocument(file, tenantRegulatorId, title, dateIssued));
    }

    @GetMapping("/upload-status/{uploadId}")
    public ResponseEntity<UploadJobResponse> getUploadStatus(@PathVariable UUID uploadId) {
        return ResponseEntity.ok(service.getUploadStatus(uploadId));
    }
}
