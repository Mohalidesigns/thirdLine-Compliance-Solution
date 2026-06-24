package com.atheris.platform.modules.browser.service;

import com.atheris.common.Constants;
import com.atheris.platform.modules.browser.dto.*;
import com.atheris.platform.modules.instruments.entity.Instrument;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.notifications.entity.ObligationWatch;
import com.atheris.platform.modules.regulators.repository.RegulatorRepository;
import com.atheris.platform.modules.notifications.repository.ObligationWatchRepository;
import com.atheris.platform.modules.notifications.service.ChangeNotificationService;
import com.atheris.platform.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.platform.modules.sanctions.repository.SanctionsRepository;
import com.atheris.platform.shared.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service @Slf4j @RequiredArgsConstructor
public class ObligationBrowserService {

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final ObligationWatchRepository watches;
    private final RegulatorRepository regulators;
    private final ChangeNotificationService notificationService;
    private final StorageService storage;

    public Page<ObligationSummaryDto> search(ObligationSearchRequest req, Pageable pageable) {
        return instruments.search(req.getRegulatorId(), req.getRiskRating(), pageable)
            .map(i -> toSummaryDto(i, req.getTenantId()));
    }

    public ObligationDetailDto findById(Long id, String tenantId) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Obligation not found: " + id));
        return toDetailDto(inst, tenantId);
    }

    public String getPdfPresignedUrl(Long instrumentId) {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        return storage.generatePresignedUrl(inst.getPdfUrl(), 3600); // 1 hour
    }

    public InputStream openPdfStream(Long instrumentId) throws IOException {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        return storage.openReadStream(inst.getPdfUrl());
    }

    public Object getClassification(Long instrumentId, String tenantId) {
        return watches.findByInstrumentIdAndTenantId(instrumentId, tenantId)
            .map(w -> Map.of(
                "instrument_id", instrumentId,
                "tenant_id", tenantId,
                "applicability", w.getClassification(),
                "classified_at", w.getClassifiedAt(),
                "is_watching", w.getIsWatching()
            ))
            .orElse(Map.of("applicability", Constants.CLASS_UNCLASSIFIED));
    }

    public Object updateWatchPreferences(Long instrumentId, String tenantId, WatchPreferencesRequest req) {
        ObligationWatch watch = watches.findByInstrumentIdAndTenantId(instrumentId, tenantId)
            .orElseThrow(() -> new RuntimeException("No watch found for this obligation"));
        if (req.getNotifyEmail() != null) watch.setNotifyEmail(req.getNotifyEmail());
        if (req.getNotifyInApp() != null) watch.setNotifyInApp(req.getNotifyInApp());
        if (req.getNotifyWebhook() != null) watch.setNotifyWebhook(req.getNotifyWebhook());
        return watches.save(watch);
    }

    public Object export(ObligationSearchRequest req, String format) {
        // Query obligations matching the filter
        // For CSV: use Apache Commons CSV or OpenCSV
        // For XLSX: use Apache POI
        // Return as byte[] with appropriate Content-Type header
        // Stub for now — implement when UI is ready
        throw new UnsupportedOperationException("Export not yet implemented");
    }

    public Page<ObligationSummaryDto> getInbox(String tenantId, String status, Pageable pageable) {
        // Received obligations not yet classified by this tenant
        return instruments.findByStatus("Published", pageable)
            .map(i -> {
                Optional<ObligationWatch> watch =
                    watches.findByInstrumentIdAndTenantId(i.getInstrumentId(), tenantId);
                String classification = watch.map(ObligationWatch::getClassification)
                    .orElse(Constants.CLASS_UNCLASSIFIED);
                if (status != null && !status.equals(classification)) return null;
                return toSummaryDto(i, tenantId);
            })
            .map(d -> d); // nulls filtered in real impl with custom query
    }

    @Transactional
    public ClassifyResponse classify(Long instrumentId, String tenantId,
                                      ClassifyRequest req, Integer userId) {
        // Validate instrument exists
        instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Obligation not found: " + instrumentId));

        // Create/update watch
        ObligationWatch watch = notificationService.upsertWatch(
            instrumentId, tenantId, req.getApplicability(), userId);

        log.info("Tenant {} classified instrument {} as {}",
            tenantId, instrumentId, req.getApplicability());

        return ClassifyResponse.builder()
            .instrumentId(instrumentId)
            .tenantId(tenantId)
            .applicability(req.getApplicability())
            .watchCreated(true)
            .message("Obligation classified. You will be notified of any updates.")
            .nextStep(Constants.CLASS_APPLICABLE.equals(req.getApplicability())
                ? "Open in compliance workspace to assign owner and link controls."
                : null)
            .build();
    }

    @Transactional
    public void removeClassification(Long instrumentId, String tenantId) {
        notificationService.removeWatch(instrumentId, tenantId);
    }

    public List<ObligationSummaryDto> getWatched(String tenantId) {
        return watches.findByTenantIdAndIsWatchingTrue(tenantId).stream()
            .map(w -> instruments.findById(w.getInstrumentId())
                .map(i -> toSummaryDto(i, tenantId))
                .orElse(null))
            .filter(dto -> dto != null)
            .toList();
    }

    private ObligationSummaryDto toSummaryDto(Instrument i, String tenantId) {
        String classification = tenantId != null
            ? watches.findByInstrumentIdAndTenantId(i.getInstrumentId(), tenantId)
                .map(ObligationWatch::getClassification).orElse(Constants.CLASS_UNCLASSIFIED)
            : null;

        String abbreviation = regulators.findById(i.getRegulatorId())
            .map(r -> r.getAbbreviation()).orElse(null);

        return ObligationSummaryDto.builder()
            .instrumentId(i.getInstrumentId())
            .sourceTitle(i.getSourceTitle())
            .regulatorId(i.getRegulatorId())
            .regulatorAbbreviation(abbreviation)
            .areaOfFocus(i.getAreaOfFocus())
            .riskRating(i.getRiskRating())
            .nature(i.getNature())
            .dateIssued(i.getDateIssued())
            .dateCommencement(i.getDateCommencement())
            .status(i.getStatus())
            .applicabilityConfidence(i.getApplicabilityConfidence())
            .tenantClassification(classification)
            .isWatching(!Constants.CLASS_UNCLASSIFIED.equals(classification))
            .build();
    }

    private ObligationDetailDto toDetailDto(Instrument i, String tenantId) {
        String classification = tenantId != null
            ? watches.findByInstrumentIdAndTenantId(i.getInstrumentId(), tenantId)
                .map(ObligationWatch::getClassification).orElse(Constants.CLASS_UNCLASSIFIED)
            : null;

        List<ObligationDetailDto.ObligationItem> oblItems =
            obligations.findByInstrumentId(i.getInstrumentId()).stream()
                .map(o -> ObligationDetailDto.ObligationItem.builder()
                    .number(o.getObligationNumber())
                    .statement(o.getPlainEnglishStatement())
                    .sectionReference(o.getSpecificSectionReference())
                    .type(o.getObligationType())
                    .recurringDeadline(o.getRecurringDeadlineType())
                    .build()).toList();

        List<ObligationDetailDto.SanctionItem> sanctionItems =
            sanctions.findByInstrumentId(i.getInstrumentId()).stream()
                .map(s -> ObligationDetailDto.SanctionItem.builder()
                    .sanctionType(s.getSanctionType())
                    .amountNaira(s.getSanctionAmountNaira())
                    .liableRoles(s.getLiableRoles())
                    .severityScore(s.getSeverityScore())
                    .hasBeenEnforced(s.getHasBeenEnforced())
                    .recentEnforcementDate(s.getRecentEnforcementDate())
                    .build()).toList();

        return ObligationDetailDto.builder()
            .instrumentId(i.getInstrumentId())
            .sourceTitle(i.getSourceTitle())
            .regulatorId(i.getRegulatorId())
            .areaOfFocus(i.getAreaOfFocus())
            .nature(i.getNature())
            .riskRating(i.getRiskRating())
            .applicabilityConfidence(i.getApplicabilityConfidence())
            .aiSummary(i.getAiSummary())
            .licenceTypesApplicable(i.getLicenceTypesApplicable())
            .dateIssued(i.getDateIssued())
            .dateCommencement(i.getDateCommencement())
            .status(i.getStatus())
            .pdfUrl(i.getPdfUrl())
            .sourceUrl(i.getSourceUrl())
            .discoveredAt(i.getDiscoveredAt())
            .tenantClassification(classification)
            .obligations(oblItems)
            .sanctions(sanctionItems)
            .build();
    }
}
