package com.atheris.compliance.tenant.backend.modules.audit.controller;

import com.atheris.compliance.tenant.backend.modules.audit.dto.AuditEventItem;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService service;

    @GetMapping("/register")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN','AUDITOR')")
    public ResponseEntity<Page<AuditEventItem>> register(
            @RequestParam(required = false) String subjectType,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Integer actorUserId,
            @RequestParam(required = false) Instant dateFrom,
            @RequestParam(required = false) Instant dateTo,
            Pageable p) {
        return ResponseEntity.ok(service.search(subjectType, subjectId, actorUserId, dateFrom, dateTo, p));
    }

    @GetMapping("/verify")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN','AUDITOR')")
    public ResponseEntity<Map<String, Object>> verify() {
        boolean valid = service.verifyChain();
        return ResponseEntity.ok(Map.of(
            "chainValid", valid,
            "message", valid
                ? "Hash chain verified — no tampering detected"
                : "WARNING: Hash chain broken — contact your system administrator"
        ));
    }
}
