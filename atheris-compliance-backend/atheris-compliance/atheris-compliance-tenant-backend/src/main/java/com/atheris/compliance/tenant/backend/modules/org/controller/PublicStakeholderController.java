package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderPortalDto;
import com.atheris.compliance.tenant.backend.modules.org.service.StakeholderPortalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public/stakeholder")
@RequiredArgsConstructor
public class PublicStakeholderController {

    private final StakeholderPortalService service;

    @GetMapping("/{id}/{token}")
    public ResponseEntity<StakeholderPortalDto> view(@PathVariable Integer id, @PathVariable String token) {
        return ResponseEntity.ok(service.view(id, token));
    }
}
