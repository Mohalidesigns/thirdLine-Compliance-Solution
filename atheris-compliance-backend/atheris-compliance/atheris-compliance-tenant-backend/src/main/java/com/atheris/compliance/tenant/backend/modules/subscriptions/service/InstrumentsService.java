package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentDetailResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentSummaryResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PagedResponse;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentSummary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class InstrumentsService {

    private final PlatformApiClient platform;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationRepository obligationRepo;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public Page<InstrumentSummaryResponse> search(String q, Pageable pageable) {
        List<Integer> platformRegIds = tenantRegulators.findByTenantIdAndIsActiveTrue(tenantId)
            .stream()
            .map(tr -> tr.getPlatformRegulatorId())
            .filter(id -> id != null)
            .toList();

        PagedResponse<PlatformInstrumentSummary> platformPage = platform.searchInstruments(q, platformRegIds, pageable);
        List<InstrumentSummaryResponse> items = platformPage.getContent().stream()
            .map(this::toSummary)
            .toList();
        return new PageImpl<>(items, pageable, platformPage.getTotalElements());
    }

    public InstrumentDetailResponse detail(Long id) {
        PlatformInstrumentDetail d = platform.getInstrumentDetail(id);
        if (d == null) throw new RuntimeException("Instrument not found");

        Map<String, com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation> localMap =
            obligationRepo.findByInstrumentId(id).stream()
                .collect(Collectors.toMap(
                    o -> o.getObligationNumber() != null ? o.getObligationNumber().toString() : "",
                    o -> o,
                    (a, b) -> a
                ));

        return InstrumentDetailResponse.builder()
            .id(d.getInstrumentId())
            .sourceTitle(d.getSourceTitle())
            .title(d.getSourceTitle())
            .regulatorAbbreviation(d.getRegulatorAbbreviation())
            .regulatorName(d.getRegulatorName())
            .documentType(d.getNature())
            .riskRating(d.getRiskRating())
            .status(d.getStatus())
            .publishedAt(d.getPublishedAt())
            .pdfUrl(d.getPdfUrl())
            .obligations(d.getObligations() != null ? d.getObligations().stream()
                .map(o -> {
                    var local = localMap.get(o.getObligationNumber() != null ? o.getObligationNumber().toString() : "");
                    return InstrumentDetailResponse.ObligationItem.builder()
                        .obligationId(local != null ? local.getObligationId() : null)
                        .description(o.getPlainEnglishStatement())
                        .section(o.getSpecificSectionReference())
                        .type(o.getObligationType())
                        .effectiveDate(local != null ? local.getEffectiveDate() : null)
                        .status(local != null ? local.getStatus() : "pending")
                        .build();
                })
                .toList() : List.of())
            .sanctions(d.getSanctions() != null ? d.getSanctions().stream()
                .map(s -> InstrumentDetailResponse.SanctionItem.builder()
                    .description(s.getSanctionType())
                    .type(s.getSanctionType())
                    .build())
                .toList() : List.of())
            .build();
    }

    private InstrumentSummaryResponse toSummary(PlatformInstrumentSummary s) {
        return InstrumentSummaryResponse.builder()
            .id(s.getInstrumentId())
            .sourceTitle(s.getSourceTitle())
            .title(s.getSourceTitle())
            .regulatorAbbreviation(s.getRegulatorAbbreviation())
            .regulatorName(s.getRegulatorName())
            .documentType(s.getDocumentType() != null ? s.getDocumentType() : s.getNature())
            .riskRating(s.getRiskRating())
            .status(s.getStatus())
            .publishedAt(s.getPublishedAt())
            .pdfUrl(s.getPdfUrl())
            .build();
    }
}
