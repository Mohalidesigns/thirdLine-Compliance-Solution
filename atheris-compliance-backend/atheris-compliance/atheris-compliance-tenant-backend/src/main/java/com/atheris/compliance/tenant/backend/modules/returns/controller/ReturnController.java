package com.atheris.compliance.tenant.backend.modules.returns.controller;

import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnFrequencyRepairService;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnEventService;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService service;
    private final ReturnFrequencyRepairService frequencyRepair;
    private final ReturnEventService returnEvents;

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
            @RequestParam(required = false) String frequencyType,
            @RequestParam(required = false) String responsibleUnit,
            @RequestParam(required = false) Long actId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean unlinked,
            Pageable p) {
        return ResponseEntity.ok(service.getRegister(q, frequency, regulator, act, frequencyType, responsibleUnit, actId, status, unlinked, p));
    }

    @GetMapping("/stats")
    public ResponseEntity<ReturnStatsDto> stats() {
        return ResponseEntity.ok(service.getStats());
    }

    /** One return's register row by id — the returns details page (schedule + current/next filing). */
    @GetMapping("/{returnId}")
    public ResponseEntity<ReturnRegisterItem> byId(@PathVariable Long returnId) {
        return ResponseEntity.ok(service.getRegisterItem(returnId));
    }

    @GetMapping("/instances/{id}/detail")
    public ResponseEntity<ReturnInstanceDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/instances/{id}/advance")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> advance(
            @PathVariable Long id,
            @Valid @RequestBody AdvanceStageRequest req,
            @AuthenticationPrincipal User u) {
        service.advanceStage(id, req, u.getUserId(), u.getFullName());
        return ResponseEntity.ok().build();
    }

    @PutMapping(value = "/instances/{id}/submit-draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnInstanceDetailResponse> submitDraft(
            @PathVariable Long id,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal User u) {
        service.submitDraft(id, files, notes, u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/instances/{id}/data-review")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnInstanceDetailResponse> dataReview(
            @PathVariable Long id,
            @RequestBody ReviewFilingRequest req,
            @AuthenticationPrincipal User u) {
        service.review(id, req.getDecision(), req.getNotes(), u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PutMapping("/instances/{id}/review")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnInstanceDetailResponse> review(
            @PathVariable Long id,
            @RequestBody ReviewFilingRequest req,
            @AuthenticationPrincipal User u) {
        service.review(id, req.getDecision(), req.getNotes(), u.getUserId());
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Long> create(
            @Valid @RequestBody CreateReturnRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(req, u.getUserId()).getReturnId());
    }

    /** Edits a return's responsible person(s) and owner (analyst, CC'd on reminders). */
    @PutMapping("/{returnId}")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnRegisterItem> update(
            @PathVariable Long returnId,
            @RequestBody UpdateReturnRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateBasic(returnId, req, u.getUserId()));
    }

    @GetMapping("/{returnId}/escalation")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnEscalationResponse> resolveEscalation(@PathVariable Long returnId) {
        return ResponseEntity.ok(service.resolveEscalation(returnId));
    }

    /** Sets the return's escalation contact + reminder cadence (stored on a per-return policy). */
    @PutMapping("/{returnId}/escalation")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnRegisterItem> updateEscalation(
            @PathVariable Long returnId,
            @RequestBody UpdateReturnEscalationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateEscalation(returnId, req, u.getUserId()));
    }

    /** Sets the frequency and due-date rule; regenerates untouched periods. Returns the updated register row. */
    @PutMapping("/{returnId}/schedule")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnRegisterItem> updateSchedule(
            @PathVariable Long returnId,
            @RequestBody UpdateScheduleRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateSchedule(returnId, req, u.getUserId()));
    }

    @PutMapping("/{returnId}/escalation-policy")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnRegisterItem> updateEscalationPolicy(
            @PathVariable Long returnId,
            @RequestBody SetReturnEscalationPolicyRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateEscalationPolicy(returnId, req.getEscalationPolicyId(), u.getUserId()));
    }

    @PutMapping("/{returnId}/event-trigger")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnRegisterItem> configureEventTrigger(
            @PathVariable Long returnId,
            @Valid @RequestBody ConfigureEventTriggerRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(returnEvents.configure(returnId, req, u.getUserId()));
    }

    @PostMapping("/{returnId}/events")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnEventFilingItem> recordEvent(
            @PathVariable Long returnId,
            @Valid @RequestBody RecordReturnEventRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(returnEvents.record(returnId, req, u.getUserId()));
    }

    @PostMapping(value = "/{returnId}/events/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ReturnEventFilingItem> recordEventWithEvidence(
            @PathVariable Long returnId,
            @RequestPart("event") @Valid RecordReturnEventRequest req,
            @RequestPart("file") org.springframework.web.multipart.MultipartFile file,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED).body(returnEvents.recordUploaded(returnId, req, file, u.getUserId()));
    }

    @GetMapping("/{returnId}/events")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.AUDITOR + "')")
    public ResponseEntity<List<ReturnEventFilingItem>> eventFilings(@PathVariable Long returnId) {
        return ResponseEntity.ok(returnEvents.list(returnId));
    }

    @GetMapping("/{returnId}/obligations")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<List<LinkedObligationItem>> linkedObligations(@PathVariable Long returnId) {
        return ResponseEntity.ok(service.linkedObligations(returnId));
    }

    @PutMapping("/{returnId}/obligations")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> linkObligations(
            @PathVariable Long returnId,
            @RequestBody LinkObligationsRequest req,
            @AuthenticationPrincipal User u) {
        service.linkObligations(returnId, req.getLinkedObligationIds(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{returnId}/send-filing-link")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FilingLinkSentResponse> sendFilingLink(
            @PathVariable Long returnId,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.sendFilingLink(returnId, u.getUserId()));
    }

    @DeleteMapping("/{returnId}")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> delete(@PathVariable Long returnId, @AuthenticationPrincipal User u) {
        service.delete(returnId, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    /** Dry run of the one-off frequency_type repair; changes nothing. */
    @GetMapping("/frequency-repair")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FrequencyRepairPreview> frequencyRepairPreview() {
        return ResponseEntity.ok(frequencyRepair.preview());
    }

    /** Applies the frequency_type repair (idempotent). */
    @PostMapping("/frequency-repair")
    @PreAuthorize("hasRole('" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<FrequencyRepairResult> frequencyRepairApply(@AuthenticationPrincipal User u) {
        return ResponseEntity.ok(frequencyRepair.apply(u.getUserId()));
    }
}
