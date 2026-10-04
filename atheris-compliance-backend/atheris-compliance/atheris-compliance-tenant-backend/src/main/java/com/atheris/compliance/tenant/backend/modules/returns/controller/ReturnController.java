package com.atheris.compliance.tenant.backend.modules.returns.controller;

import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnFrequencyRepairService;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService service;
    private final ReturnFrequencyRepairService frequencyRepair;

    @GetMapping("/list")
    public ResponseEntity<List<RegulatoryReturn>> list() {
        return ResponseEntity.ok(service.listActive());
    }

    @GetMapping("/calendar")
    public ResponseEntity<Page<ReturnInstanceItem>> calendar(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) Long returnId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String frequency,
            @RequestParam(required = false) String regulator,
            @RequestParam(required = false) String act,
            Pageable p) {
        return ResponseEntity.ok(service.getCalendar(period, returnId, status, q, frequency, regulator, act, p));
    }

    @GetMapping("/register")
    public ResponseEntity<Page<ReturnRegisterItem>> register(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String frequency,
            @RequestParam(required = false) String regulator,
            @RequestParam(required = false) String act,
            @RequestParam(required = false) String status,
            Pageable p) {
        return ResponseEntity.ok(service.getRegister(q, frequency, regulator, act, status, p));
    }

    @GetMapping("/stats")
    public ResponseEntity<ReturnStatsDto> stats() {
        return ResponseEntity.ok(service.getStats());
    }

    @GetMapping("/instances/{id}/detail")
    public ResponseEntity<ReturnInstanceDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/instances/{id}/advance")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> advance(
            @PathVariable Long id,
            @Valid @RequestBody AdvanceStageRequest req,
            @AuthenticationPrincipal User u) {
        service.advanceStage(id, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/instances/{id}/submit")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> submit(
            @PathVariable Long id,
            @RequestBody AdvanceStageRequest req,
            @AuthenticationPrincipal User u) {
        service.submit(id, req.getEvidenceUrl(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Long> create(
            @Valid @RequestBody CreateReturnRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(req, u.getUserId()).getReturnId());
    }

    /**
     * Sets the schedule of many returns at once (all-or-nothing). Literal path, so it never collides with
     * {@code /{returnId}/...}; any row error → 400 with {@code rowErrors}.
     */
    @PutMapping("/schedules")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<BulkScheduleResponse> bulkUpdateSchedules(
            @RequestBody BulkScheduleRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.bulkUpdateSchedules(req, u.getUserId()));
    }

    /** Sets the frequency and due-date rule; regenerates untouched periods. Returns the updated register row. */
    @PutMapping("/{returnId}/schedule")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<ReturnRegisterItem> updateSchedule(
            @PathVariable Long returnId,
            @RequestBody UpdateScheduleRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateSchedule(returnId, req, u.getUserId()));
    }

    @GetMapping("/{returnId}/obligations")
    @PreAuthorize("hasAnyRole('ANALYST','CCO','TENANT_ADMIN')")
    public ResponseEntity<List<LinkedObligationItem>> linkedObligations(@PathVariable Long returnId) {
        return ResponseEntity.ok(service.linkedObligations(returnId));
    }

    @PutMapping("/{returnId}/obligations")
    @PreAuthorize("hasAnyRole('CCO','TENANT_ADMIN')")
    public ResponseEntity<Void> linkObligations(
            @PathVariable Long returnId,
            @RequestBody LinkObligationsRequest req,
            @AuthenticationPrincipal User u) {
        service.linkObligations(returnId, req.getLinkedObligationIds(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    /** Dry run of the one-off frequency_type repair; changes nothing. */
    @GetMapping("/frequency-repair")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<FrequencyRepairPreview> frequencyRepairPreview() {
        return ResponseEntity.ok(frequencyRepair.preview());
    }

    /** Applies the frequency_type repair (idempotent). */
    @PostMapping("/frequency-repair")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<FrequencyRepairResult> frequencyRepairApply(@AuthenticationPrincipal User u) {
        return ResponseEntity.ok(frequencyRepair.apply(u.getUserId()));
    }
}
