package com.atheris.compliance.tenant.backend.modules.review.controller;

import com.atheris.compliance.tenant.backend.modules.review.dto.*;
import com.atheris.compliance.tenant.backend.modules.review.service.ReviewService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<Page<ReviewItem>> list(
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            Pageable p) {
        return ResponseEntity.ok(service.list(source, status, q, p));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<ReviewStats> stats() {
        return ResponseEntity.ok(service.stats());
    }

    @GetMapping("/{reviewId}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<ReviewDetail> get(@PathVariable Long reviewId) {
        return ResponseEntity.ok(service.get(reviewId));
    }

    @PostMapping("/{reviewId}/save")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<Void> save(@PathVariable Long reviewId,
                                     @RequestBody SaveReviewRequest req,
                                     @AuthenticationPrincipal User u) {
        service.save(reviewId, req, u.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{reviewId}/skip")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<Void> skip(@PathVariable Long reviewId,
                                     @AuthenticationPrincipal User u) {
        service.skip(reviewId, u.getUserId());
        return ResponseEntity.ok().build();
    }
}
