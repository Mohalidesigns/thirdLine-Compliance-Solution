package com.atheris.compliance.tenant.backend.modules.tasks.controller;

import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskItemDto;
import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskStatsDto;
import com.atheris.compliance.tenant.backend.modules.tasks.service.TaskCenterService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks/center")
@RequiredArgsConstructor
public class TaskCenterController {

    private final TaskCenterService service;

    @GetMapping
    public ResponseEntity<Page<TaskItemDto>> list(
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer ownerUserId,
            @AuthenticationPrincipal User u,
            Pageable p) {
        return ResponseEntity.ok(service.page(assignee, category, priority, q, ownerUserId,
            u == null ? null : u.getUserId(), p));
    }

    @GetMapping("/stats")
    public ResponseEntity<TaskStatsDto> stats(
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) Integer ownerUserId,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.stats(assignee, ownerUserId, u == null ? null : u.getUserId()));
    }
}
