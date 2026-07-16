package com.atheris.compliance.tenant.backend.modules.audit.controller;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN','AUDITOR')")
    public ResponseEntity<Page<AuditEvent>> list(Pageable p) {
        return ResponseEntity.ok(service.findAll(p));
    }

    @GetMapping("/{subjectType}/{subjectId}")
    public ResponseEntity<Page<AuditEvent>> bySubject(
            @PathVariable String subjectType,
            @PathVariable Long subjectId,
            Pageable p) {
        return ResponseEntity.ok(service.findBySubject(subjectType, subjectId, p));
    }

    @GetMapping("/verify")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN','AUDITOR')")
    public ResponseEntity<Map<String, Object>> verify() {
        boolean valid = service.verifyChain();
        return ResponseEntity.ok(Map.of(
            "chain_valid", valid,
            "message", valid
                ? "Hash chain verified — no tampering detected"
                : "WARNING: Hash chain broken"
        ));
    }
}
