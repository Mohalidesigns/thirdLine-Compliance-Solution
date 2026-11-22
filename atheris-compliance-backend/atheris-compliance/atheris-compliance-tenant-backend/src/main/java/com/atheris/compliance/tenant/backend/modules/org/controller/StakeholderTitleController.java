package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderTitleDto;
import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderTitleRequest;
import com.atheris.compliance.tenant.backend.modules.org.service.StakeholderTitleService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stakeholder-titles")
@RequiredArgsConstructor
public class StakeholderTitleController {

    private final StakeholderTitleService service;

    @GetMapping
    public ResponseEntity<List<StakeholderTitleDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<StakeholderTitleDto> create(@RequestBody StakeholderTitleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<StakeholderTitleDto> update(@PathVariable Integer id,
            @RequestBody StakeholderTitleRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }
}
