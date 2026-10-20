package com.atheris.compliance.tenant.backend.modules.runbooks.controller;

import com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.service.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.List;

/** Runbook library, versions, approvals, schedules, frameworks, templates and coverage. Thin: all logic is in services. */
@RestController
@RequestMapping("/api/v1/runbooks")
@RequiredArgsConstructor
public class RunbookController {

    private final RunbookService service;
    private final RunbookScheduleService schedules;
    private final RunbookFrameworkService frameworks;
    private final RunbookTemplateService templates;
    private final UserRepository users;

    // library
    @GetMapping
    @PreAuthorize(RunbookRoles.ALL)
    public Page<RunbookSummaryDto> list(@RequestParam(required = false) String q, @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String status, @RequestParam(required = false) Integer frameworkId,
                                        @RequestParam(required = false) Integer ownerId, @RequestParam(required = false) String criticality,
                                        @RequestParam(required = false) String frequency, @RequestParam(required = false) Integer dueWithinDays,
                                        @RequestParam(required = false) Boolean needsReview,
                                        @PageableDefault(size = 20, sort = "updatedAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable p) {
        return service.list(q, category, status, frameworkId, ownerId, criticality, frequency, dueWithinDays, needsReview, p);
    }

    @GetMapping("/stats")
    @PreAuthorize(RunbookRoles.ALL)
    public RunbookStatsDto stats() {
        return service.stats();
    }

    @GetMapping("/dashboard")
    @PreAuthorize(RunbookRoles.ALL)
    public RunbookDashboardDto dashboard() {
        return frameworks.dashboard();
    }

    @GetMapping("/assignees")
    @PreAuthorize(RunbookRoles.ALL)
    public List<AssigneeDto> assignees() {
        return users.findAll().stream().filter(u -> !Boolean.FALSE.equals(u.getIsActive()))
            .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
            .map(u -> AssigneeDto.builder().userId(u.getUserId()).fullName(u.getFullName()).email(u.getEmail()).role(u.getRole()).build())
            .toList();
    }

    @PostMapping
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto create(@RequestBody CreateRunbookRequest req, @AuthenticationPrincipal User u) {
        return service.create(req, u);
    }

    @GetMapping("/{id}")
    @PreAuthorize(RunbookRoles.ALL)
    public RunbookDetailDto detail(@PathVariable Long id) {
        var rb = service.find(id);
        return service.detail(rb, templates.latestVersion(rb.getSourceTemplateCode()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto update(@PathVariable Long id, @RequestBody UpdateRunbookRequest req, @AuthenticationPrincipal User u) {
        return service.update(id, req, u);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User u) {
        service.delete(id, u);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto clone(@PathVariable Long id, @RequestBody(required = false) ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.clone(id, req != null ? req.getTitle() : null, u);
    }

    @PostMapping("/{id}/deprecate")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookDetailDto deprecate(@PathVariable Long id, @RequestBody ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.setLifecycle(id, RunbookConstants.RB_DEPRECATED, req.getReason(), u);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookDetailDto archive(@PathVariable Long id, @RequestBody ReasonRequest req, @AuthenticationPrincipal User u) {
        return service.setLifecycle(id, RunbookConstants.RB_ARCHIVED, req.getReason(), u);
    }

    @PutMapping("/{id}/clauses")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto setClauses(@PathVariable Long id, @RequestBody ClauseIdsRequest req, @AuthenticationPrincipal User u) {
        return service.setClauses(id, req.getClauseIds(), u);
    }

    @PutMapping("/{id}/links")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto setLinks(@PathVariable Long id, @RequestBody LinksRequest req, @AuthenticationPrincipal User u) {
        return service.setLinks(id, req, u);
    }

    @GetMapping("/{id}/export")
    @PreAuthorize(RunbookRoles.ALL)
    public ResponseEntity<byte[]> export(@PathVariable Long id, @RequestParam(defaultValue = "json") String format,
                                         @AuthenticationPrincipal User u) {
        if (!"json".equalsIgnoreCase(format)) throw com.atheris.compliance.tenant.backend.shared.exception.ApiException.badRequest("Only format=json is supported");
        byte[] body = service.exportJson(id, u);
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setContentDisposition(ContentDisposition.attachment().filename(service.find(id).getRunbookCode() + ".runbook.json").build());
        return ResponseEntity.ok().headers(h).body(body);
    }

    @PostMapping("/import")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookDetailDto importJson(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User u) {
        return service.importJson(file, u);
    }

    // versions
    @GetMapping("/{id}/versions")
    @PreAuthorize(RunbookRoles.ALL)
    public List<RunbookVersionSummaryDto> versions(@PathVariable Long id) {
        return service.versions(id);
    }

    @PostMapping("/{id}/versions")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookVersionTreeDto createDraft(@PathVariable Long id, @AuthenticationPrincipal User u) {
        return service.createDraft(id, u);
    }

    @GetMapping("/{id}/versions/{vid}")
    @PreAuthorize(RunbookRoles.ALL)
    public RunbookVersionTreeDto version(@PathVariable Long id, @PathVariable Long vid) {
        return service.version(id, vid);
    }

    @PutMapping("/{id}/versions/{vid}")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public SaveVersionResponse save(@PathVariable Long id, @PathVariable Long vid, @RequestBody SaveVersionRequest req,
                                    @AuthenticationPrincipal User u) {
        return service.save(id, vid, req, u);
    }

    /** Read-only: computes the lint report, persists nothing. */
    @PostMapping("/{id}/versions/{vid}/lint")
    @PreAuthorize(RunbookRoles.ALL)
    public LintReportDto lint(@PathVariable Long id, @PathVariable Long vid) {
        return service.lint(id, vid);
    }

    @GetMapping("/{id}/versions/{vid}/diff/{otherVid}")
    @PreAuthorize(RunbookRoles.ALL)
    public VersionDiffDto diff(@PathVariable Long id, @PathVariable Long vid, @PathVariable Long otherVid) {
        return service.diff(id, vid, otherVid);
    }

    @PostMapping("/{id}/versions/{vid}/submit")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookVersionTreeDto submit(@PathVariable Long id, @PathVariable Long vid, @AuthenticationPrincipal User u) {
        return service.submit(id, vid, u);
    }

    @PostMapping("/{id}/versions/{vid}/approve")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookVersionTreeDto approve(@PathVariable Long id, @PathVariable Long vid, @RequestBody VersionDecisionRequest req,
                                         @AuthenticationPrincipal User u) {
        return service.approve(id, vid, req, u);
    }

    @PostMapping("/{id}/versions/{vid}/reject")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookVersionTreeDto reject(@PathVariable Long id, @PathVariable Long vid, @RequestBody VersionDecisionRequest req,
                                        @AuthenticationPrincipal User u) {
        return service.reject(id, vid, req, u);
    }

    @PostMapping("/{id}/versions/{vid}/publish")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookVersionTreeDto publish(@PathVariable Long id, @PathVariable Long vid, @RequestBody VersionDecisionRequest req,
                                         @AuthenticationPrincipal User u) {
        return service.publish(id, vid, req.getChangeSummary(), u);
    }

    @PostMapping("/{id}/template-revision")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public RunbookDetailDto templateRevision(@PathVariable Long id, @AuthenticationPrincipal User u) {
        return templates.revisionFromTemplate(id, u);
    }

    @GetMapping("/approvals/pending")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public List<ApprovalQueueItemDto> pendingApprovals() {
        return service.pendingApprovals();
    }

    // schedules
    @GetMapping("/{id}/schedules")
    @PreAuthorize(RunbookRoles.ALL)
    public List<ScheduleDto> schedules(@PathVariable Long id) {
        service.find(id);
        return schedules.list(id);
    }

    @PostMapping("/{id}/schedules")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public ScheduleDto createSchedule(@PathVariable Long id, @RequestBody ScheduleRequest req, @AuthenticationPrincipal User u) {
        return schedules.create(id, req, u.getUserId());
    }

    @PutMapping("/{id}/schedules/{sid}")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public ScheduleDto updateSchedule(@PathVariable Long id, @PathVariable Long sid, @RequestBody ScheduleRequest req,
                                      @AuthenticationPrincipal User u) {
        return schedules.update(id, sid, req, u.getUserId());
    }

    @DeleteMapping("/{id}/schedules/{sid}")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long id, @PathVariable Long sid, @AuthenticationPrincipal User u) {
        schedules.delete(id, sid, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    // frameworks
    @GetMapping("/frameworks")
    @PreAuthorize(RunbookRoles.ALL)
    public List<FrameworkDto> frameworks() {
        return frameworks.list();
    }

    @GetMapping("/frameworks/{fid}/clauses")
    @PreAuthorize(RunbookRoles.ALL)
    public List<ClauseDto> clauses(@PathVariable Integer fid, @RequestParam(required = false) String q,
                                   @RequestParam(required = false) String domain) {
        return frameworks.clauses(fid, q, domain);
    }

    @GetMapping("/clauses")
    @PreAuthorize(RunbookRoles.ALL)
    public List<ClauseDto> searchClauses(@RequestParam(required = false) String q, @RequestParam(required = false) Integer frameworkId,
                                         @RequestParam(required = false) String domain) {
        return frameworks.clauses(frameworkId, q, domain);
    }

    @PostMapping("/frameworks")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public FrameworkDto createFramework(@RequestBody FrameworkRequest req, @AuthenticationPrincipal User u) {
        return frameworks.createInternal(req, u.getUserId());
    }

    @PostMapping("/frameworks/{fid}/clauses")
    @PreAuthorize(RunbookRoles.APPROVERS)
    public ClauseDto addClause(@PathVariable Integer fid, @RequestBody ClauseRequest req, @AuthenticationPrincipal User u) {
        return frameworks.addClause(fid, req, u.getUserId());
    }

    // templates
    @GetMapping("/templates")
    @PreAuthorize(RunbookRoles.ALL)
    public List<TemplateSummaryDto> templates() {
        return templates.list();
    }

    @GetMapping("/templates/{code}")
    @PreAuthorize(RunbookRoles.ALL)
    public TemplateDetailDto template(@PathVariable String code) {
        return templates.get(code);
    }

    // Adopting only creates a DRAFT (authoring); approval/publish stays with APPROVERS.
    @PostMapping("/templates/{code}/adopt")
    @PreAuthorize(RunbookRoles.AUTHORS)
    public RunbookDetailDto adopt(@PathVariable String code, @RequestBody AdoptTemplateRequest req, @AuthenticationPrincipal User u) {
        return templates.adopt(code, req, u);
    }

    // coverage
    @GetMapping("/coverage")
    @PreAuthorize(RunbookRoles.ALL)
    public CoverageDto coverage(@RequestParam(required = false) Integer frameworkId) {
        return frameworks.coverage(frameworkId);
    }
}
