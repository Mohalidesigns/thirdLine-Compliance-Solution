package com.atheris.compliance.tenant.backend.modules.settings.controller;

import com.atheris.compliance.tenant.backend.modules.settings.dto.PollingConfigRequest;
import com.atheris.compliance.tenant.backend.modules.settings.dto.PollingConfigResponse;
import com.atheris.compliance.tenant.backend.modules.settings.dto.SmtpConfigRequest;
import com.atheris.compliance.tenant.backend.modules.settings.dto.SmtpConfigResponse;
import com.atheris.compliance.tenant.backend.modules.settings.service.SettingsService;
import com.atheris.compliance.tenant.backend.modules.settings.service.SmtpSettingsService;
import com.atheris.compliance.tenant.backend.modules.notifications.dto.NotificationTemplateDto;
import com.atheris.compliance.tenant.backend.modules.notifications.dto.NotificationTemplateRequest;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService service;
    private final SmtpSettingsService smtpSettings;
    private final NotificationTemplateService templates;

    @GetMapping("/polling")
    public ResponseEntity<PollingConfigResponse> getPolling() {
        return ResponseEntity.ok(service.getPollingConfig());
    }

    @PutMapping("/polling")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<Void> updatePolling(@Valid @RequestBody PollingConfigRequest req) {
        service.updatePollingConfig(req.getIntervalMinutes());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/smtp")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<SmtpConfigResponse> getSmtp() {
        return ResponseEntity.ok(smtpSettings.get());
    }

    @PutMapping("/smtp")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<SmtpConfigResponse> updateSmtp(@RequestBody SmtpConfigRequest req) {
        smtpSettings.save(req);
        return ResponseEntity.ok(smtpSettings.get());
    }

    @PostMapping("/smtp/test")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<Map<String, Object>> testSmtp(@RequestBody SmtpConfigRequest req) {
        return ResponseEntity.ok(smtpSettings.test(req));
    }

    @GetMapping("/notification-templates")
    public ResponseEntity<List<NotificationTemplateDto>> listTemplates() {
        return ResponseEntity.ok(templates.list());
    }

    @GetMapping("/notification-templates/{key}")
    public ResponseEntity<NotificationTemplateDto> getTemplate(@PathVariable String key) {
        return ResponseEntity.ok(templates.get(key));
    }

    @PutMapping("/notification-templates/{key}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<NotificationTemplateDto> updateTemplate(@PathVariable String key,
                                                                  @RequestBody NotificationTemplateRequest req,
                                                                  @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(templates.update(key, req, u.getUserId()));
    }
}
