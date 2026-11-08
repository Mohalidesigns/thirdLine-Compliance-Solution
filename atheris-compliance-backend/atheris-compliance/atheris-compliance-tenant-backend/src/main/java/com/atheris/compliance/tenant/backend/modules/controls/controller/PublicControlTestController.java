package com.atheris.compliance.tenant.backend.modules.controls.controller;

import com.atheris.compliance.tenant.backend.modules.controls.dto.PublicControlTestView;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/public/control-test")
@RequiredArgsConstructor
public class PublicControlTestController {

    private final ControlTestLinkService service;

    @GetMapping("/{token}")
    public ResponseEntity<PublicControlTestView> view(@PathVariable String token) {
        return ResponseEntity.ok(service.view(token));
    }

    @PostMapping(value = "/{token}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String token,
            @RequestParam(value = "testDate", required = false) String testDate,
            @RequestParam(value = "result") String result,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "failureDetails", required = false) String failureDetails,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        LocalDate date = testDate == null || testDate.isBlank() ? null : LocalDate.parse(testDate);
        service.submit(token, date, result, notes, failureDetails, file);
        return ResponseEntity.ok(Map.of("status", "submitted"));
    }
}
