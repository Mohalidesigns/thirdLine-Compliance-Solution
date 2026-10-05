package com.atheris.compliance.tenant.backend.modules.evidence.controller;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.exception.DocumentUnavailableException;
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
        } catch (java.nio.file.NoSuchFileException e) {
            // The row points at a file that is no longer on disk: same 404 contract as instrument PDFs.
            throw new DocumentUnavailableException("The stored file for this evidence is no longer available");
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Failed to read evidence file " + id, e);
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<EvidenceFile> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) Long sourceId,
            @RequestParam(required = false) String description,
            @AuthenticationPrincipal User u) {
        if (file == null || file.isEmpty())
            throw ApiException.badRequest("empty_file", "The uploaded file is empty");
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.upload(file, sourceType, sourceId, description, u.getUserId()));
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Evidence upload failed", e);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<EvidenceFile> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getFile(id));
    }
}
