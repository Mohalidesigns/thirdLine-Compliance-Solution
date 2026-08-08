package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.*;
import com.atheris.compliance.tenant.backend.modules.org.service.OrgService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/org")
@RequiredArgsConstructor
public class OrgController {

    private final OrgService service;

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
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<DepartmentDto> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDepartment(request));
    }

    @PutMapping("/departments/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<DepartmentDto> updateDepartment(
            @PathVariable Integer id,
            @RequestBody DepartmentRequest request) {
        return ResponseEntity.ok(service.updateDepartment(id, request));
    }

    @DeleteMapping("/departments/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Integer id) {
        service.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teams")
    public ResponseEntity<List<TeamDto>> teams(@RequestParam(required = false) Integer departmentId) {
        return ResponseEntity.ok(service.listTeams(departmentId));
    }

    @PostMapping("/teams")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<TeamDto> createTeam(@Valid @RequestBody TeamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createTeam(request));
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<TeamDto> updateTeam(
            @PathVariable Integer id,
            @RequestBody TeamRequest request) {
        return ResponseEntity.ok(service.updateTeam(id, request));
    }

    @DeleteMapping("/teams/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<Void> deleteTeam(@PathVariable Integer id) {
        service.deleteTeam(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/owners")
    public ResponseEntity<List<OwnerDto>> owners(
            @RequestParam(required = false) Integer teamId,
            @RequestParam(required = false) Integer departmentId) {
        return ResponseEntity.ok(service.listOwners(teamId, departmentId));
    }

    @PostMapping("/owners")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<OwnerDto> createOwner(@Valid @RequestBody OwnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createOwner(request));
    }

    @PutMapping("/owners/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<OwnerDto> updateOwner(
            @PathVariable Integer id,
            @RequestBody OwnerRequest request) {
        return ResponseEntity.ok(service.updateOwner(id, request));
    }

    @DeleteMapping("/owners/{id}")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<Void> deleteOwner(@PathVariable Integer id) {
        service.deleteOwner(id);
        return ResponseEntity.noContent().build();
    }
}
