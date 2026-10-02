package com.atheris.compliance.tenant.backend.modules.imports.controller;

import com.atheris.compliance.tenant.backend.modules.imports.dto.ImportBatchSummary;
import com.atheris.compliance.tenant.backend.modules.imports.dto.ImportFile;
import com.atheris.compliance.tenant.backend.modules.imports.dto.ImportPreviewResponse;
import com.atheris.compliance.tenant.backend.modules.imports.service.ImportService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/imports")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
public class ImportController {

    private static final MediaType XLSX =
        MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ImportService service;

    @GetMapping("/{type}/template")
    public ResponseEntity<byte[]> template(@PathVariable String type) {
        return xlsx(service.template(type));
    }

    @PostMapping(value = "/{type}/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportPreviewResponse> preview(
            @PathVariable String type,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.preview(type, file, u.getUserId(), u.getFullName(), u.getRole()));
    }

    @PostMapping("/batches/{batchId}/commit")
    public ResponseEntity<ImportBatchSummary> commit(
            @PathVariable Long batchId,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.commit(batchId, u.getUserId(), u.getRole()));
    }

    @GetMapping("/batches/{batchId}/errors")
    public ResponseEntity<byte[]> errors(@PathVariable Long batchId, @AuthenticationPrincipal User u) {
        return xlsx(service.errorReport(batchId, u.getRole()));
    }

    @GetMapping("/batches")
    public ResponseEntity<List<ImportBatchSummary>> batches(@RequestParam(required = false) String type,
                                                            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.listBatches(type, u.getRole()));
    }

    private static ResponseEntity<byte[]> xlsx(ImportFile f) {
        return ResponseEntity.ok()
            .contentType(XLSX)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(f.fileName()).build().toString())
            .body(f.content());
    }
}
