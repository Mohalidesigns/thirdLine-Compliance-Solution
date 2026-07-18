package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.CreateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.TenantRegulatorDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UpdateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.RegulatorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/subscriptions/regulators")
@RequiredArgsConstructor
public class RegulatorController {

    private final RegulatorService service;

    @GetMapping
    public ResponseEntity<Page<TenantRegulatorDto>> list(
            @RequestParam(required = false) String search,
            Pageable pageable) {
        return ResponseEntity.ok(service.list(search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantRegulatorDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<TenantRegulatorDto> create(@Valid @RequestBody CreateRegulatorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<TenantRegulatorDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRegulatorRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
