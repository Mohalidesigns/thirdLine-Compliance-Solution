package com.atheris.compliance.intelligence.backend.modules.regulators.controller;

import com.atheris.compliance.intelligence.backend.modules.regulators.dto.RegulatorDto;
import com.atheris.compliance.intelligence.backend.modules.regulators.service.RegulatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/internal/regulators")
@RequiredArgsConstructor
public class InternalRegulatorController {

    private final RegulatorService regulatorService;

    @GetMapping
    public ResponseEntity<List<RegulatorDto>> listActive() {
        return ResponseEntity.ok(
            regulatorService.findAllFiltered(true, null, null, null));
    }
}
