package com.atheris.compliance.tenant.backend.modules.requirements.controller;

import com.atheris.compliance.tenant.backend.modules.requirements.dto.RequirementDto;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.RequirementRequest;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.StateOverrideRequest;
import com.atheris.compliance.tenant.backend.modules.requirements.service.RequirementService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RequirementController {

    private static final String WRITERS =
        "hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')";

    private final RequirementService service;

    @GetMapping("/obligations/{obligationId}/requirements")
    public ResponseEntity<List<RequirementDto>> forObligation(@PathVariable Long obligationId) {
        return ResponseEntity.ok(service.forObligation(obligationId));
    }

    @GetMapping("/requirements/{id}")
    public ResponseEntity<RequirementDto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }

    @PostMapping("/requirements")
    @PreAuthorize(WRITERS)
    public ResponseEntity<RequirementDto> create(@RequestBody RequirementRequest req, @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.create(req, u.getUserId()));
    }

    @PutMapping("/requirements/{id}")
    @PreAuthorize(WRITERS)
    public ResponseEntity<RequirementDto> update(@PathVariable Long id, @RequestBody RequirementRequest req,
                                                 @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.update(id, req, u.getUserId()));
    }

    @DeleteMapping("/requirements/{id}")
    @PreAuthorize(WRITERS)
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User u) {
        service.delete(id, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/requirements/{id}/controls")
    @PreAuthorize(WRITERS)
    public ResponseEntity<RequirementDto> setControls(@PathVariable Long id, @RequestBody List<Integer> controlIds,
                                                      @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.setControls(id, controlIds, u.getUserId()));
    }

    @PutMapping("/requirements/{id}/state")
    @PreAuthorize(WRITERS)
    public ResponseEntity<RequirementDto> setOverride(@PathVariable Long id, @RequestBody StateOverrideRequest req,
                                                      @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.setOverride(id, req, u.getUserId()));
    }
}
