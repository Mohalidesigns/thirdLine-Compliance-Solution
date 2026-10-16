package com.atheris.compliance.tenant.backend.modules.runbooks.controller;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.service.RunbookEvidencePackService;
import com.atheris.compliance.tenant.backend.modules.runbooks.service.RunbookExecutionService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/** Runbook executions: start, step transitions, evidence (append-only), escalation, rollback, sign-off, pack. */
@RestController
@RequiredArgsConstructor
public class RunbookExecutionController {

    private static final ZoneId LAGOS = ZoneId.of("Africa/Lagos");

    private final RunbookExecutionService service;
    private final RunbookEvidencePackService packs;

    @GetMapping("/api/v1/runbooks/executions")
    @PreAuthorize(RunbookRoles.ALL)
    public Page<ExecutionSummaryDto> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                          @RequestParam(required = false) Long runbookId, @RequestParam(required = false) Integer operatorId,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                          @RequestParam(required = false) Boolean overdue,
                                          @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        Instant f = from != null ? from.atStartOfDay(LAGOS).toInstant() : null;
        Instant t = to != null ? to.plusDays(1).atStartOfDay(LAGOS).toInstant() : null;
        return service.list(q, status, runbookId, operatorId, f, t, overdue, p);
    }

    @GetMapping("/api/v1/runbooks/executions/stats")
    @PreAuthorize(RunbookRoles.ALL)
    public ExecutionStatsDto stats() {
        return service.stats();
    }

    @PostMapping("/api/v1/runbooks/{runbookId}/executions")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto start(@PathVariable Long runbookId, @RequestBody StartExecutionRequest req, @AuthenticationPrincipal User u) {
        return service.start(runbookId, req, u);
    }

    @GetMapping("/api/v1/runbooks/executions/{execId}")
    @PreAuthorize(RunbookRoles.ALL)
    public ExecutionDetailDto detail(@PathVariable Long execId) {
        return service.detail(execId);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/preflight")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto preflight(@PathVariable Long execId, @RequestBody PreflightRequest req, @AuthenticationPrincipal User u) {
        return service.preflight(execId, req.getPrereqAcks(), u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/start")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto startStep(@PathVariable Long execId, @PathVariable Long stepExecId, @AuthenticationPrincipal User u) {
        return service.startStep(execId, stepExecId, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/pass")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto pass(@PathVariable Long execId, @PathVariable Long stepExecId, @RequestBody PassStepRequest req,
                                   @AuthenticationPrincipal User u) {
        return service.pass(execId, stepExecId, req, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/fail")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto fail(@PathVariable Long execId, @PathVariable Long stepExecId, @RequestBody FailStepRequest req,
                                   @AuthenticationPrincipal User u) {
        return service.fail(execId, stepExecId, req, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/skip")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto skip(@PathVariable Long execId, @PathVariable Long stepExecId, @RequestBody SkipStepRequest req,
                                   @AuthenticationPrincipal User u) {
        return service.skip(execId, stepExecId, req, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/verify")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto verify(@PathVariable Long execId, @PathVariable Long stepExecId, @RequestBody VerifyStepRequest req,
                                     @AuthenticationPrincipal User u) {
        return service.verify(execId, stepExecId, req.getPassword(), u);
    }

    /** Append-only: there is deliberately no PUT or DELETE for evidence. */
    @PostMapping(value = "/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto captureEvidence(@PathVariable Long execId, @PathVariable Long stepExecId,
                                              @RequestParam(required = false) MultipartFile file,
                                              @RequestParam(required = false) Long reqId,
                                              @RequestParam(required = false) String evidenceType,
                                              @RequestParam(required = false) String externalRef,
                                              @RequestParam(required = false) String attestationText,
                                              @RequestParam(required = false) String pastedOutput,
                                              @AuthenticationPrincipal User u) {
        return service.captureEvidence(execId, stepExecId, file, reqId, evidenceType, externalRef, attestationText, pastedOutput, u);
    }

    @GetMapping("/api/v1/runbooks/executions/{execId}/steps/{stepExecId}/evidence")
    @PreAuthorize(RunbookRoles.ALL)
    public List<EvidenceItemDto> stepEvidence(@PathVariable Long execId, @PathVariable Long stepExecId) {
        return service.stepEvidence(execId, stepExecId);
    }

    @GetMapping("/api/v1/runbooks/executions/{execId}/evidence/{evidenceId}/download")
    @PreAuthorize(RunbookRoles.ALL)
    public ResponseEntity<byte[]> downloadEvidence(@PathVariable Long execId, @PathVariable Long evidenceId) {
        Map.Entry<EvidenceFile, byte[]> f = service.downloadEvidence(execId, evidenceId);
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType(f.getKey().getMimeType() != null ? f.getKey().getMimeType() : "application/octet-stream"));
        h.setContentDisposition(ContentDisposition.attachment().filename(f.getKey().getOriginalName()).build());
        return ResponseEntity.ok().headers(h).body(f.getValue());
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/pause")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto pause(@PathVariable Long execId, @RequestBody(required = false) ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.pause(execId, req != null ? req.getReason() : null, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/resume")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto resume(@PathVariable Long execId, @AuthenticationPrincipal User u) {
        return service.resume(execId, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/abort")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto abort(@PathVariable Long execId, @RequestBody ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.abort(execId, req.getReason(), u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/escalate")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto escalate(@PathVariable Long execId, @RequestBody EscalateRequest req, @AuthenticationPrincipal User u) {
        return service.escalate(execId, req, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/escalations/{escId}/ack")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto ack(@PathVariable Long execId, @PathVariable Long escId, @AuthenticationPrincipal User u) {
        return service.acknowledge(execId, escId, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/rollback")
    @PreAuthorize(RunbookRoles.EXECUTORS)
    public ExecutionDetailDto rollback(@PathVariable Long execId, @RequestBody ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.rollback(execId, req.getReason(), u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/signoff")
    @PreAuthorize(RunbookRoles.SIGNERS)
    public ExecutionDetailDto signoff(@PathVariable Long execId, @RequestBody SignoffRequest req, @AuthenticationPrincipal User u) {
        return service.signoff(execId, req, u);
    }

    @PostMapping("/api/v1/runbooks/executions/{execId}/pack")
    @PreAuthorize(RunbookRoles.PACK)
    public ExecutionDetailDto generatePack(@PathVariable Long execId, @RequestBody(required = false) PackRequest req,
                                           @AuthenticationPrincipal User u) {
        return packs.generate(execId, req, u);
    }

    @GetMapping("/api/v1/runbooks/executions/{execId}/pack")
    @PreAuthorize(RunbookRoles.ALL)
    public ResponseEntity<byte[]> downloadPack(@PathVariable Long execId, @AuthenticationPrincipal User u) {
        Map.Entry<String, byte[]> f = packs.download(execId, u);
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType("application/zip"));
        h.setContentDisposition(ContentDisposition.attachment().filename(f.getKey()).build());
        return ResponseEntity.ok().headers(h).body(f.getValue());
    }

    @GetMapping("/api/v1/runbooks/executions/{execId}/timeline")
    @PreAuthorize(RunbookRoles.ALL)
    public List<TimelineEventDto> timeline(@PathVariable Long execId) {
        return service.timeline(execId);
    }
}
