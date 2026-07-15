package com.atheris.tenant.modules.notifications.controller;

import com.atheris.tenant.modules.notifications.entity.ObligationNotification;
import com.atheris.tenant.modules.notifications.service.NotificationService;
import com.atheris.tenant.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public ResponseEntity<List<ObligationNotification>> list(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(service.findByStatus(status));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> count() {
        return ResponseEntity.ok(service.getCount());
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
    public ResponseEntity<Void> markAllRead() {
        service.markAllRead();
        return ResponseEntity.noContent().build();
    }
}
