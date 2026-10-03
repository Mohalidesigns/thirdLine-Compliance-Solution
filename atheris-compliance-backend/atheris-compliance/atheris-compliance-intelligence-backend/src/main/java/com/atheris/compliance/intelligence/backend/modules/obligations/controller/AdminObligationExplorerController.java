package com.atheris.compliance.intelligence.backend.modules.obligations.controller;

import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerDetail;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerItem;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerStats;
import com.atheris.compliance.intelligence.backend.modules.obligations.service.ObligationExplorerService;
import com.atheris.compliance.intelligence.backend.modules.obligations.service.ObligationExplorerService.ListFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

/** The only controller on /api/v1/admin/obligations (platform-admin obligations explorer). */
@RestController
@RequestMapping("/api/v1/admin/obligations")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminObligationExplorerController {

    private final ObligationExplorerService service;

    /**
     * Filters: q, risk (alias inherentRiskRating), regulatorId, regulator (abbreviation), areaOfFocus,
     * actId (alias regulationId), act (name), obligationType, hasPoints. Sort: title, risk, areaOfFocus, id, ...
     */
    @GetMapping
    public ResponseEntity<Page<ObligationExplorerItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String risk,
            @RequestParam(required = false) String inherentRiskRating,
            @RequestParam(required = false) Integer regulatorId,
            @RequestParam(required = false) String regulator,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) Long actId,
            @RequestParam(required = false) Long regulationId,
            @RequestParam(required = false) String act,
            @RequestParam(required = false) String obligationType,
            @RequestParam(required = false) Boolean hasPoints,
            Pageable pageable) {
        ListFilter filter = new ListFilter(q, risk != null ? risk : inherentRiskRating, regulatorId, regulator,
                areaOfFocus, actId != null ? actId : regulationId, act, obligationType, hasPoints);
        return ResponseEntity.ok(service.list(filter, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<ObligationExplorerStats> stats() {
        return ResponseEntity.ok(service.getStats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObligationExplorerDetail> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDetail(id));
    }

    @GetMapping("/{id}/controls")
    public ResponseEntity<List<ObligationExplorerDetail.ControlInfo>> controls(@PathVariable Long id) {
        return ResponseEntity.ok(service.getLinkedControls(id));
    }

    /** Streams the source instrument's PDF; 404 DOCUMENT_UNAVAILABLE when none is stored. */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> pdf(@PathVariable Long id,
                                        @RequestParam(defaultValue = "false") boolean download) throws IOException {
        String filename = "obligation-" + id + ".pdf";
        ContentDisposition disposition = download
                ? ContentDisposition.attachment().filename(filename).build()
                : ContentDisposition.inline().filename(filename).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(new InputStreamResource(service.openPdfStream(id)));
    }
}
