package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.*;
import com.atheris.compliance.tenant.backend.modules.org.service.OrgService;
import com.atheris.compliance.tenant.backend.modules.org.service.DepartmentReportService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/org")
@RequiredArgsConstructor
public class OrgController {

    private final OrgService service;
    private final DepartmentReportService reportService;

    @GetMapping
    public ResponseEntity<OrgTreeResponse> tree() {
        return ResponseEntity.ok(service.getOrgTree());
    }

    @GetMapping("/departments")
    public ResponseEntity<List<DepartmentDto>> departments(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(service.listDepartments(activeOnly));
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<DepartmentDto> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDepartment(request));
    }

    @PutMapping("/departments/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<DepartmentDto> updateDepartment(
            @PathVariable Integer id,
            @RequestBody DepartmentRequest request) {
        return ResponseEntity.ok(service.updateDepartment(id, request));
    }

    @DeleteMapping("/departments/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Integer id) {
        service.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/departments/{id}/head")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> setDepartmentHead(@PathVariable Integer id, @RequestBody HeadRequest request) {
        service.setDepartmentHead(id, request.getHeadOwnerId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/departments/{id}/head")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> clearDepartmentHead(@PathVariable Integer id) {
        service.clearDepartmentHead(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/departments/{id}/report-link")
    public ResponseEntity<Map<String, String>> departmentReportLink(@PathVariable Integer id) {
        return ResponseEntity.ok(Map.of("path", reportService.departmentPath(id)));
    }

    @GetMapping("/teams")
    public ResponseEntity<List<TeamDto>> teams(@RequestParam(required = false) Integer departmentId) {
        return ResponseEntity.ok(service.listTeams(departmentId));
    }

    @PostMapping("/teams")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<TeamDto> createTeam(@Valid @RequestBody TeamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createTeam(request));
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<TeamDto> updateTeam(
            @PathVariable Integer id,
            @RequestBody TeamRequest request) {
        return ResponseEntity.ok(service.updateTeam(id, request));
    }

    @DeleteMapping("/teams/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> deleteTeam(@PathVariable Integer id) {
        service.deleteTeam(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/teams/{id}/head")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> setTeamHead(@PathVariable Integer id, @RequestBody HeadRequest request) {
        service.setTeamHead(id, request.getHeadOwnerId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/teams/{id}/head")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<Void> clearTeamHead(@PathVariable Integer id) {
        service.clearTeamHead(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teams/{id}/report-link")
    public ResponseEntity<Map<String, String>> unitReportLink(@PathVariable Integer id) {
        return ResponseEntity.ok(Map.of("path", reportService.unitPath(id)));
    }

    @GetMapping("/owners")
    public ResponseEntity<List<OwnerDto>> owners(
            @RequestParam(required = false) Integer teamId,
            @RequestParam(required = false) Integer departmentId) {
        return ResponseEntity.ok(service.listOwners(teamId, departmentId));
    }

    @PostMapping("/owners")
    // CCO and analysts assign findings/obligations to owners, so they can add them. Edit/delete stay admin-only.
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<OwnerDto> createOwner(@Valid @RequestBody OwnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createOwner(request));
    }

    @PutMapping("/owners/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<OwnerDto> updateOwner(
            @PathVariable Integer id,
            @RequestBody OwnerRequest request) {
        return ResponseEntity.ok(service.updateOwner(id, request));
    }

    @DeleteMapping("/owners/{id}")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> deleteOwner(@PathVariable Integer id) {
        service.deleteOwner(id);
        return ResponseEntity.noContent().build();
    }
}
