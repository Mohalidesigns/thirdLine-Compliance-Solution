package com.atheris.compliance.tenant.backend.modules.notifications.controller;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.ObligationNotification;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/**
 * A caller only ever sees their own notifications plus anything broadcast to their role.
 */
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public ResponseEntity<List<ObligationNotification>> list(
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.forUser(u.getUserId(), u.getRole(), status));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> count(@AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.countForUser(u.getUserId(), u.getRole()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObligationNotification> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        service.markRead(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/acknowledge")
    public ResponseEntity<Void> acknowledge(
            @PathVariable Long id,
            @AuthenticationPrincipal User u) {
        service.acknowledge(id, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal User u) {
        service.markAllRead(u.getUserId(), u.getRole());
        return ResponseEntity.noContent().build();
    }
}