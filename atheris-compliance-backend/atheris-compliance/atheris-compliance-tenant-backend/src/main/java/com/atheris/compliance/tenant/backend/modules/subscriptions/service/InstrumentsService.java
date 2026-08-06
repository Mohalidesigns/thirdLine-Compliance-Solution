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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

        Set<Long> confirmed = new HashSet<>(obligationRepo.findDistinctInstrumentIds());

        int fetchSize = Math.max(pageable.getPageSize(), 200);
        PagedResponse<PlatformInstrumentSummary> platformPage =
            platform.searchInstruments(q, platformRegIds, PageRequest.of(0, fetchSize));

        List<InstrumentSummaryResponse> all = platformPage.getContent().stream()
            .filter(s -> confirmed.contains(s.getInstrumentId()))
            .map(this::toSummary)
            .toList();

        int from = (int) pageable.getOffset();
        if (from >= all.size()) return new PageImpl<>(List.of(), pageable, all.size());
        int to = Math.min(from + pageable.getPageSize(), all.size());
        return new PageImpl<>(all.subList(from, to), pageable, all.size());
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
            .aiSummary(d.getAiSummary())
            .pdfOcrText(d.getPdfOcrText())
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

    public byte[] pdfBytes(Long id) {
        byte[] bytes = platform.getInstrumentPdf(id);
        if (bytes == null || bytes.length == 0) throw new RuntimeException("Instrument PDF not available");
        return bytes;
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
            .publishedAt(s.getPublishedAt() != null ? s.getPublishedAt() : s.getDateIssued())
            .pdfUrl(s.getPdfUrl())
            .obligationCount((int) obligationRepo.countByInstrumentId(s.getInstrumentId()))
            .build();
    }
}
