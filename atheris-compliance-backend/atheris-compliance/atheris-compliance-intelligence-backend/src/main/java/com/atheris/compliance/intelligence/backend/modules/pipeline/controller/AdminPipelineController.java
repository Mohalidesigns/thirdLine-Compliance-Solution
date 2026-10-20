package com.atheris.compliance.intelligence.backend.modules.pipeline.controller;

import com.atheris.compliance.intelligence.backend.modules.pipeline.dto.PipelineItemDto;
import com.atheris.compliance.intelligence.backend.modules.pipeline.dto.PipelineStatsDto;
import com.atheris.compliance.intelligence.backend.modules.pipeline.service.PipelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/pipeline")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminPipelineController {

    private final PipelineService service;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer regulatorId,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate discoveredFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate discoveredTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PipelineService.PipelinePage result = service.list(q, regulatorId, stage, discoveredFrom, discoveredTo, page, size);
        return ResponseEntity.ok(Map.of(
            "content", result.rows(),
            "totalElements", result.total(),
            "totalPages", size > 0 ? (int) Math.ceil((double) result.total() / size) : 0,
            "number", page,
            "size", size));
    }

    @GetMapping("/stats")
    public ResponseEntity<PipelineStatsDto> stats() {
        return ResponseEntity.ok(service.stats());
    }
}
