package com.atheris.compliance.intelligence.backend.modules.internal.controller;

import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalRegulationSeed;
import com.atheris.compliance.intelligence.backend.modules.internal.service.InternalRegulationSeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/internal/regulations")
@RequiredArgsConstructor
public class InternalRegulationSeedController {

    private final InternalRegulationSeedService service;

    @GetMapping("/seed")
    public ResponseEntity<List<InternalRegulationSeed>> seed(
            @RequestParam List<Integer> regulatorIds) {
        return ResponseEntity.ok(service.seedForRegulators(regulatorIds));
    }
}