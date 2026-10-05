package com.atheris.compliance.tenant.backend.modules.holidays.controller;

import com.atheris.compliance.tenant.backend.modules.holidays.dto.FederalPublicHolidayDto;
import com.atheris.compliance.tenant.backend.modules.holidays.dto.FederalPublicHolidayRequest;
import com.atheris.compliance.tenant.backend.modules.holidays.service.FederalPublicHolidayService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/federal-public-holidays")
@RequiredArgsConstructor
public class FederalPublicHolidayController {
    private final FederalPublicHolidayService service;

    @GetMapping
    public ResponseEntity<List<FederalPublicHolidayDto>> list(@RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(service.list(year));
    }
    @PostMapping
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<FederalPublicHolidayDto> create(@Valid @RequestBody FederalPublicHolidayRequest req,
                                                           @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user.getUserId()));
    }
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<FederalPublicHolidayDto> update(@PathVariable Long id, @Valid @RequestBody FederalPublicHolidayRequest req,
                                                           @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(service.update(id, req, user.getUserId()));
    }
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        service.delete(id, user.getUserId());
        return ResponseEntity.noContent().build();
    }
}
