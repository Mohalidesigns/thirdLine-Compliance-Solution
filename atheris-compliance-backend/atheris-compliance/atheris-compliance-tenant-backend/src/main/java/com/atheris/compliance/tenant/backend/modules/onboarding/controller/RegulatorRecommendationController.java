package com.atheris.compliance.tenant.backend.modules.onboarding.controller;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.RegulatorRecommendation;
import com.atheris.compliance.tenant.backend.modules.onboarding.service.RegulatorRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/recommendations")
@RequiredArgsConstructor
public class RegulatorRecommendationController {

    private final RegulatorRecommendationService service;

    @GetMapping
    public ResponseEntity<List<RegulatorRecommendation>> list(
            @RequestParam(required = false) String licenceType) {
        if (licenceType != null) {
            return ResponseEntity.ok(service.findByLicenceType(licenceType));
        }
        return ResponseEntity.ok(service.findAll());
    }

    @PostMapping
    public ResponseEntity<RegulatorRecommendation> create(
            @RequestBody RegulatorRecommendation rec) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(rec));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RegulatorRecommendation> update(
            @PathVariable Integer id,
            @RequestBody RegulatorRecommendation rec) {
        return ResponseEntity.ok(service.update(id, rec));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
