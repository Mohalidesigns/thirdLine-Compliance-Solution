package com.atheris.compliance.tenant.backend.modules.returns.controller;

import com.atheris.compliance.tenant.backend.modules.returns.dto.CreateReturnUploadLinkRequest;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnUploadLinkService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Analyst-facing action to create (and email) a public, account-less link that lets a return's
 * owner record an event filing with evidence.
 */
@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnUploadLinkController {

    private final ReturnUploadLinkService service;

    @PostMapping("/{returnId}/upload-link")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable Long returnId,
            @RequestBody(required = false) CreateReturnUploadLinkRequest req,
            @AuthenticationPrincipal User u) {
        String token = service.createLink(returnId,
            req == null ? null : req.getRecipientEmail(),
            req == null ? null : req.getRecipientName(),
            u.getUserId());
        return ResponseEntity.ok(Map.of(
            "token", token,
            "path", service.uploadPath(token)));
    }
}
