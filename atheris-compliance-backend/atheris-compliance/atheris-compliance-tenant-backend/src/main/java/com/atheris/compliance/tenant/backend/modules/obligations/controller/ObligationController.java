package com.atheris.compliance.tenant.backend.modules.obligations.controller;

import com.atheris.compliance.tenant.backend.modules.obligations.dto.*;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.RiskType;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RiskTypeRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/obligations")
@RequiredArgsConstructor
public class ObligationController {

    private final ObligationService service;
    private final RiskTypeRepository riskTypes;

    @GetMapping("/risk-types")
    public ResponseEntity<List<RiskType>> listRiskTypes() {
        return ResponseEntity.ok(riskTypes.findAllByOrderByDisplayOrderAsc());
    }

    @GetMapping("/register")
    public ResponseEntity<Page<ObligationRegisterItem>> register(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String risk,
            @RequestParam(required = false) String regulator,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean noControl,
            @RequestParam(required = false) Long instrumentId,
            @RequestParam(required = false) String act,
            @RequestParam(required = false) Boolean hasPoints,
            @RequestParam(required = false) Boolean hasReturns,
            @RequestParam(required = false) String cells,
            @RequestParam(required = false) String riskView,
            Pageable p) {
        return ResponseEntity.ok(service.getRegisterList(
            q, risk, regulator, areaOfFocus, owner, status, noControl, instrumentId, act, hasPoints, hasReturns,
            cells, riskView, p));
    }

    @GetMapping("/stats")
    public ResponseEntity<ObligationStats> stats() {
        return ResponseEntity.ok(service.getStats());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ObligationRegisterItem> create(
            @Valid @RequestBody ObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.createObligation(req, u.getUserId()));
    }

    @PutMapping("/obligation/{obligationId}")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ObligationRegisterItem> update(
            @PathVariable Long obligationId,
            @Valid @RequestBody ObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateObligation(obligationId, req, u.getUserId()));
    }

    @DeleteMapping("/obligation/{obligationId}")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> delete(
            @PathVariable Long obligationId,
            @AuthenticationPrincipal User u) {
        service.deleteObligation(obligationId, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/obligation/{obligationId}")
    public ResponseEntity<ObligationDetailView> obligationDetail(@PathVariable Long obligationId) {
        return ResponseEntity.ok(service.getObligationDetail(obligationId));
    }

    @PutMapping("/obligation/{obligationId}/returns")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> linkReturns(
            @PathVariable Long obligationId,
            @RequestBody LinkReturnRequest req,
            @AuthenticationPrincipal User u) {
        service.linkReturns(obligationId, req.getLinkedReturnIds(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/inbox")
    public ResponseEntity<Page<InboxItemResponse>> inbox(Pageable p) {
        return ResponseEntity.ok(service.getInbox(p));
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<ObligationDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @PostMapping("/{id}/classify")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ObligationClassificationDto> classify(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.classify(id, req, u.getUserId()));
    }

    @PutMapping("/{id}/classify")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ObligationClassificationDto> update(
            @PathVariable Long id,
            @Valid @RequestBody ClassifyObligationRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.classify(id, req, u.getUserId()));
    }

    @PutMapping("/{id}/owner")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> assignOwner(
            @PathVariable Long id,
            @RequestBody AssignOwnerRequest req,
            @AuthenticationPrincipal User u) {
        service.assignOwner(id, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/risk")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> updateRisk(
            @PathVariable Long id,
            @RequestBody RiskAssessmentRequest req,
            @AuthenticationPrincipal User u) {
        service.updateRisk(id, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/controls")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> linkControls(
            @PathVariable Long id,
            @RequestBody LinkControlsRequest req,
            @AuthenticationPrincipal User u) {
        service.linkControls(id, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/sanctions")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Void> linkSanctions(
            @PathVariable Long id,
            @RequestBody LinkSanctionsRequest req,
            @AuthenticationPrincipal User u) {
        service.linkSanctions(id, req.getLinkedSanctionIds(), u.getUserId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<?>> history(@PathVariable Long id) {
        return ResponseEntity.ok(service.getHistory(id));
    }
}
