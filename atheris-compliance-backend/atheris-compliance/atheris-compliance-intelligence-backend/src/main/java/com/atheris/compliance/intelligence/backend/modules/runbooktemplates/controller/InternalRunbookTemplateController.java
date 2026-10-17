package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.controller;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateDto;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service.RunbookTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Tenant backends pull PUBLISHED runbook templates here (X-Api-Key via ApiKeyFilter). */
@RestController
@RequestMapping("/api/v1/internal/runbook-templates")
@RequiredArgsConstructor
public class InternalRunbookTemplateController {

    private final RunbookTemplateService service;

    @GetMapping
    public ResponseEntity<List<RunbookTemplateDto>> list() {
        return ResponseEntity.ok(service.listPublished());
    }

    @GetMapping("/{code}")
    public ResponseEntity<RunbookTemplateDto> get(@PathVariable String code) {
        return ResponseEntity.ok(service.getPublished(code));
    }
}
