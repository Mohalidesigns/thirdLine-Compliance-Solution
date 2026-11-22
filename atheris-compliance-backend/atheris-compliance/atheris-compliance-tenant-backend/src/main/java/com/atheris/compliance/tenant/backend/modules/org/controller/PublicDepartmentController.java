package com.atheris.compliance.tenant.backend.modules.org.controller;

import com.atheris.compliance.tenant.backend.modules.org.dto.DepartmentReportDto;
import com.atheris.compliance.tenant.backend.modules.org.service.DepartmentReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicDepartmentController {

    private final DepartmentReportService service;

    @GetMapping("/department/{id}/{token}")
    public ResponseEntity<DepartmentReportDto> department(@PathVariable Integer id, @PathVariable String token) {
        return ResponseEntity.ok(service.departmentReport(id, token));
    }

    @GetMapping("/unit/{id}/{token}")
    public ResponseEntity<DepartmentReportDto> unit(@PathVariable Integer id, @PathVariable String token) {
        return ResponseEntity.ok(service.unitReport(id, token));
    }
}
