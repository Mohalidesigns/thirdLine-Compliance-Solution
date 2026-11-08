package com.atheris.compliance.tenant.backend.modules.controls.controller;

import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlTestLinkSentResponse;
import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestLinkService;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class ControlTestController {

    private final ControlTestService service;
    private final ControlTestLinkService testLinks;

    @GetMapping("/api/v1/controls/{id}/tests")
    public ResponseEntity<List<ControlTestResult>> getTests(@PathVariable Integer id) {
        return ResponseEntity.ok(service.getTestHistory(id));
    }

    @PostMapping("/api/v1/controls/{id}/tests")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ControlTestResult> recordTest(
            @PathVariable Integer id,
            @Valid @RequestBody RecordTestRequest req,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.recordTest(id, req, u));
    }

    /** Email the responsible person (tester) the deterministic link to record this control's test result. */
    @PostMapping("/api/v1/controls/{id}/send-test-link")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<ControlTestLinkSentResponse> sendTestLink(
            @PathVariable Integer id,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(testLinks.sendTestLink(id, u));
    }

    @PutMapping("/api/v1/controls/{id}/tests/{testId}/review")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<ControlTestResult> reviewTest(
            @PathVariable Integer id,
            @PathVariable Long testId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User u) {
        // Segregation of duties (self-review block) is enforced in the service.
        return ResponseEntity.ok(
            service.reviewTest(testId, body.get("decision"), body.get("notes"), u));
    }

    /** Open (Pending/In Progress/Overdue) test tasks for one control. */
    @GetMapping("/api/v1/controls/{id}/tasks")
    public ResponseEntity<List<ControlTask>> controlTasks(@PathVariable Integer id) {
        return ResponseEntity.ok(service.getTasksForControl(id));
    }

    @GetMapping("/api/v1/tests/pending-review")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<List<ControlTestResult>> pendingReview() {
        return ResponseEntity.ok(service.getPendingReview());
    }

    @GetMapping("/api/v1/tasks")
    public ResponseEntity<List<ControlTask>> myTasks(@AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.getTasksForUser(u.getUserId()));
    }

    @GetMapping("/api/v1/tasks/overdue")
    @PreAuthorize("hasAnyRole('" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<List<ControlTask>> overdueTasks() {
        return ResponseEntity.ok(service.getAllOverdue());
    }
}
