package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.*;
import com.atheris.compliance.tenant.backend.modules.org.service.StakeholderPortalService;
import com.atheris.compliance.tenant.backend.modules.org.service.StakeholderService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/stakeholders")
@RequiredArgsConstructor
public class StakeholderController {

    private final StakeholderService service;
    private final StakeholderPortalService portal;
    private final com.atheris.compliance.tenant.backend.modules.org.service.StakeholderBulkImportService bulkImport;

    @GetMapping
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<List<StakeholderDto>> list(
            @RequestParam(required = false) Integer departmentId,
            @RequestParam(required = false) Integer teamId,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(service.list(departmentId, teamId, q));
    }

    @PostMapping(value = "/bulk-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<com.atheris.compliance.tenant.backend.modules.org.dto.StakeholderImportResult> bulkImport(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return ResponseEntity.ok(bulkImport.importFile(file));
    }

    @GetMapping("/roles")
    public ResponseEntity<List<StakeholderRoleDto>> roles() {
        return ResponseEntity.ok(service.listRoles());
    }

    @GetMapping("/{id}/access-link")
    public ResponseEntity<Map<String, String>> accessLink(@PathVariable Integer id) {
        return ResponseEntity.ok(Map.of("path", portal.pathFor(id)));
    }

    @GetMapping("/{id}/assignments")
    public ResponseEntity<List<StakeholderAssignmentDto>> assignments(@PathVariable Integer id) {
        return ResponseEntity.ok(service.listAssignments(id));
    }

    @PostMapping("/{id}/assignments")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<StakeholderAssignmentDto> assign(
            @PathVariable Integer id, @Valid @RequestBody AssignStakeholderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.assign(id, request, null));
    }

    @DeleteMapping("/assignments/{assignmentId}")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> unassign(@PathVariable Long assignmentId) {
        service.unassign(assignmentId);
        return ResponseEntity.noContent().build();
    }
}
