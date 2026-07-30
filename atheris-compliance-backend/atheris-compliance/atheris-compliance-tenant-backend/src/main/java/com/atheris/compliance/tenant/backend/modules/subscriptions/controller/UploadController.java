package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.*;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.UploadJob;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
            @RequestParam(value = "tenant_regulator_id", required = false) Long tenantRegulatorId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "date_issued", required = false) String dateIssued) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(service.uploadDocument(file, tenantRegulatorId, title, dateIssued));
    }

    @GetMapping("/uploads")
    public ResponseEntity<Page<UploadJob>> list(Pageable pageable) {
        return ResponseEntity.ok(service.list(pageable));
    }

    @GetMapping("/upload-status/{uploadId}")
    public ResponseEntity<UploadJobResponse> getUploadStatus(@PathVariable UUID uploadId) {
        return ResponseEntity.ok(service.getUploadStatus(uploadId));
    }

    @GetMapping("/uploads/{uploadId}/review")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<UploadReviewResponse> getReview(@PathVariable UUID uploadId) {
        return ResponseEntity.ok(service.getReview(uploadId));
    }

    @PostMapping("/uploads/{uploadId}/confirm")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<UploadJobResponse> confirm(@PathVariable UUID uploadId,
                                                      @RequestBody ConfirmUploadRequest req) {
        return ResponseEntity.ok(service.confirm(uploadId, req));
    }
}
