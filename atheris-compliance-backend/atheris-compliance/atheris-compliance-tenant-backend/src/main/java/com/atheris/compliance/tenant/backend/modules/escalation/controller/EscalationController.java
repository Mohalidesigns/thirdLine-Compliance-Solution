package com.atheris.compliance.tenant.backend.modules.escalation.controller;

import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationInstanceDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationInstanceRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/escalation")
@RequiredArgsConstructor
public class EscalationController {

    private final EscalationPolicyService service;

    @GetMapping("/policies")
    public ResponseEntity<List<EscalationPolicyDto>> list(@RequestParam(required = false) String subjectType,
                                                          @RequestParam(required = false) Boolean defaultsOnly) {
        return ResponseEntity.ok(service.list(subjectType, Boolean.TRUE.equals(defaultsOnly)));
    }

    @GetMapping("/policies/{id}")
    public ResponseEntity<EscalationPolicyDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping("/policies")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<EscalationPolicyDto> create(@RequestBody EscalationPolicyRequest req,
                                                      @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, u.getUserId()));
    }

    @PutMapping("/policies/{id}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<EscalationPolicyDto> update(@PathVariable Long id,
                                                      @RequestBody EscalationPolicyRequest req,
                                                      @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.update(id, req, u.getUserId()));
    }

    @DeleteMapping("/policies/{id}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "')")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User u) {
        service.delete(id, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/instances/{subjectType}/{subjectId}")
    public ResponseEntity<EscalationInstanceDto> getInstance(@PathVariable String subjectType,
                                                             @PathVariable Long subjectId) {
        return ResponseEntity.ok(service.getInstance(subjectType.toUpperCase(), subjectId));
    }

    @PutMapping("/instances/{subjectType}/{subjectId}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<EscalationInstanceDto> saveInstance(@PathVariable String subjectType,
                                                              @PathVariable Long subjectId,
                                                              @RequestBody EscalationInstanceRequest req,
                                                              @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.saveInstance(subjectType.toUpperCase(), subjectId, req, u.getUserId()));
    }

    @DeleteMapping("/instances/{subjectType}/{subjectId}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> deleteInstance(@PathVariable String subjectType,
                                               @PathVariable Long subjectId,
                                               @AuthenticationPrincipal User u) {
        service.deleteInstance(subjectType.toUpperCase(), subjectId, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/instances/{subjectType}/{subjectId}/reapply")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<EscalationInstanceDto> reapply(@PathVariable String subjectType,
                                                         @PathVariable Long subjectId,
                                                         @RequestParam Long policyId,
                                                         @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.freezeFromPolicy(subjectType.toUpperCase(), subjectId, policyId, u.getUserId()));
    }
}
