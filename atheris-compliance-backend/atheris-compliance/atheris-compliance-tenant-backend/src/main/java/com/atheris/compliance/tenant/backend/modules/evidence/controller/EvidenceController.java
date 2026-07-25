package com.atheris.compliance.tenant.backend.modules.evidence.controller;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/evidence")
@RequiredArgsConstructor
public class EvidenceController {

    private final EvidenceVaultService service;

    @GetMapping
    public ResponseEntity<Page<EvidenceFile>> list(Pageable p) {
        return ResponseEntity.ok(service.list(p));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        EvidenceFile f = service.getFile(id);
        try {
            byte[] data = service.download(f);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                f.getMimeType() != null ? f.getMimeType() : "application/octet-stream"));
            headers.setContentDisposition(ContentDisposition.attachment()
                .filename(f.getOriginalName()).build());
            headers.setContentLength(data.length);
            return new ResponseEntity<>(data, headers, HttpStatus.OK);
        } catch (Exception e) {
            throw new RuntimeException("Failed to download file", e);
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<EvidenceFile> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) Long sourceId,
            @RequestParam(required = false) String description,
            @AuthenticationPrincipal User u) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.upload(file, sourceType, sourceId, description, u.getUserId()));
        } catch (Exception e) {
            throw new RuntimeException("Upload failed", e);
        }
    }
}
