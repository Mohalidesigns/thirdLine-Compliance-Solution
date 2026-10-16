package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentDetailResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.InstrumentSummaryResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UniverseInstrumentItem;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UniverseStatsResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.exception.DocumentUnavailableException;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PagedResponse;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentSummary;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class InstrumentsService {

    private final PlatformApiClient platform;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationRepository obligationRepo;
    private final TenantIdentityService tenantIdentity;

    public Page<InstrumentSummaryResponse> search(String q, Pageable pageable) {
        List<PlatformInstrumentSummary> filtered = confirmedUniverse(q);

        List<Long> filteredIds = filtered.stream().map(PlatformInstrumentSummary::getInstrumentId).toList();
        Map<Long, Integer> countMap = new java.util.HashMap<>();
        if (!filteredIds.isEmpty()) {
            for (Object[] row : obligationRepo.countByInstrumentIdIn(filteredIds)) {
                countMap.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
            }
        }

        List<InstrumentSummaryResponse> all = filtered.stream()
            .map(s -> toSummary(s, countMap))
            .toList();

        int from = (int) pageable.getOffset();
        if (from >= all.size()) return new PageImpl<>(List.of(), pageable, all.size());
        int to = Math.min(from + pageable.getPageSize(), all.size());
        return new PageImpl<>(all.subList(from, to), pageable, all.size());
    }

    /**
     * Aggregates the tenant's compliance universe for the dashboard: the same instrument set as
     * {@link #search} (subscribed regulators, confirmed into the register).
     */
    public UniverseStatsResponse universeStats() {
        List<PlatformInstrumentSummary> universe = confirmedUniverse("");

        Map<String, Map<String, Long>> regulatorsByRisk = universe.stream()
            .filter(s -> s.getRiskRating() != null)
            .collect(Collectors.groupingBy(PlatformInstrumentSummary::getRiskRating,
                Collectors.collectingAndThen(Collectors.toList(), l -> countSorted(l, InstrumentsService::regulatorLabel))));

        return UniverseStatsResponse.builder()
            .total(universe.size())
            .byRiskRating(countSorted(universe, PlatformInstrumentSummary::getRiskRating))
            .byRegulator(countSorted(universe, InstrumentsService::regulatorLabel))
            .byNature(countSorted(universe, PlatformInstrumentSummary::getNature))
            .byAreaOfFocus(countSorted(universe, PlatformInstrumentSummary::getAreaOfFocus))
            .byStatus(countSorted(universe, PlatformInstrumentSummary::getStatus))
            .regulatorsByRisk(regulatorsByRisk)
            .build();
    }

    /**
     * Platform instruments of the tenant's active regulators that have been confirmed into the
     * register (have local obligations). Pages through the whole platform search — the confirmed
     * set is usually scattered well beyond the first page.
     */
    private List<PlatformInstrumentSummary> confirmedUniverse(String q) {
        Set<Long> confirmed = new HashSet<>(obligationRepo.findDistinctInstrumentIds());
        if (confirmed.isEmpty()) return List.of();
        Long tenantId = tenantIdentity.currentTenantId();
        List<Integer> platformRegIds = tenantRegulators.findByTenantIdAndIsActiveTrue(tenantId)
            .stream()
            .map(tr -> tr.getPlatformRegulatorId())
            .filter(id -> id != null)
            .toList();

        List<PlatformInstrumentSummary> universe = new ArrayList<>();
        int page = 0;
        int totalPages;
        do {
            PagedResponse<PlatformInstrumentSummary> resp =
                platform.searchInstruments(q, platformRegIds, PageRequest.of(page, UNIVERSE_PAGE_SIZE));
            resp.getContent().stream()
                .filter(s -> confirmed.contains(s.getInstrumentId()))
                .forEach(universe::add);
            totalPages = resp.getTotalPages();
            page++;
        } while (page < totalPages && page < UNIVERSE_MAX_PAGES);
        return universe;
    }

    /**
     * The Compliance Universe table: the tenant's confirmed universe, filtered and sorted in memory
     * (the rows come from the platform API, so there is no local query to push filters into).
     * Filters match exactly (case-insensitive); {@code q} is a title/reference substring.
     */
    public Page<UniverseInstrumentItem> universeInstruments(String q, String regulator, String areaOfFocus,
                                                            String riskRating, String nature, String status,
                                                            Pageable pageable) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<PlatformInstrumentSummary> rows = confirmedUniverse("").stream()
            .filter(s -> matches(regulatorLabel(s), regulator) || matches(s.getRegulatorAbbreviation(), regulator))
            .filter(s -> matches(s.getAreaOfFocus(), areaOfFocus))
            .filter(s -> matches(s.getRiskRating(), riskRating))
            .filter(s -> matches(s.getNature(), nature))
            .filter(s -> matches(s.getStatus(), status))
            .filter(s -> needle.isEmpty()
                || contains(s.getSourceTitle(), needle) || contains(s.getSourceReferenceNumber(), needle))
            .sorted(universeOrder(pageable.getSort()))
            .toList();

        int from = (int) Math.min(pageable.getOffset(), rows.size());
        int to = Math.min(from + pageable.getPageSize(), rows.size());
        List<PlatformInstrumentSummary> slice = rows.subList(from, to);

        Map<Long, Integer> countMap = new java.util.HashMap<>();
        List<Long> ids = slice.stream().map(PlatformInstrumentSummary::getInstrumentId).toList();
        if (!ids.isEmpty()) {
            for (Object[] row : obligationRepo.countByInstrumentIdIn(ids)) {
                countMap.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
            }
        }

        List<UniverseInstrumentItem> items = slice.stream().map(s -> UniverseInstrumentItem.builder()
            .instrumentId(s.getInstrumentId())
            .sourceTitle(s.getSourceTitle())
            .sourceReferenceNumber(s.getSourceReferenceNumber())
            .regulatorName(regulatorLabel(s))
            .regulatorAbbreviation(s.getRegulatorAbbreviation())
            .documentType(s.getDocumentType())
            .nature(s.getNature())
            .areaOfFocus(s.getAreaOfFocus())
            .riskRating(s.getRiskRating())
            .status(s.getStatus())
            .dateIssued(s.getDateIssued())
            .obligationCount(countMap.getOrDefault(s.getInstrumentId(), 0))
            .build()).toList();
        return new PageImpl<>(items, pageable, rows.size());
    }

    private static final Map<String, Integer> RISK_RANK = Map.of(
        "critical", 0, "very high", 1, "high", 2, "moderate", 3, "medium", 3, "low", 4, "very low", 5);

    /** Whitelisted sorts (unknown properties are ignored); default newest issued first, then title. */
    private static Comparator<PlatformInstrumentSummary> universeOrder(Sort sort) {
        Comparator<PlatformInstrumentSummary> byTitle = Comparator.comparing(
            s -> s.getSourceTitle() == null ? "" : s.getSourceTitle().toLowerCase());
        Comparator<PlatformInstrumentSummary> order = null;
        for (Sort.Order o : sort) {
            Comparator<PlatformInstrumentSummary> c = switch (o.getProperty()) {
                case "sourceTitle" -> byTitle;
                case "regulatorName" -> Comparator.comparing(
                    s -> { String r = regulatorLabel(s); return r == null ? "" : r.toLowerCase(); });
                case "riskRating" -> Comparator.comparing(
                    s -> RISK_RANK.getOrDefault(s.getRiskRating() == null ? "" : s.getRiskRating().toLowerCase(), 9));
                case "areaOfFocus" -> Comparator.comparing(
                    s -> s.getAreaOfFocus() == null ? "" : s.getAreaOfFocus().toLowerCase());
                case "dateIssued" -> Comparator.comparing(PlatformInstrumentSummary::getDateIssued,
                    Comparator.nullsFirst(Comparator.naturalOrder()));
                default -> null;
            };
            if (c == null) continue;
            if (o.isDescending()) c = c.reversed();
            order = order == null ? c : order.thenComparing(c);
        }
        if (order == null) {
            order = Comparator.comparing(PlatformInstrumentSummary::getDateIssued,
                Comparator.nullsLast(Comparator.<java.time.LocalDate>reverseOrder()));
        }
        return order.thenComparing(byTitle);
    }

    private static boolean matches(String value, String filter) {
        return filter == null || filter.isBlank() || (value != null && value.equalsIgnoreCase(filter.trim()));
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }

    private static final int UNIVERSE_PAGE_SIZE = 500;
    private static final int UNIVERSE_MAX_PAGES = 20;

    private static String regulatorLabel(PlatformInstrumentSummary s) {
        return s.getRegulatorName() != null ? s.getRegulatorName() : s.getRegulatorAbbreviation();
    }

    /** Count by key (blank keys skipped), ordered by count desc then key. */
    private static Map<String, Long> countSorted(List<PlatformInstrumentSummary> items,
                                                 Function<PlatformInstrumentSummary, String> key) {
        Map<String, Long> counts = items.stream()
            .map(key)
            .filter(k -> k != null && !k.isBlank())
            .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return counts.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                .thenComparing(Map.Entry.comparingByKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    public InstrumentDetailResponse detail(Long id) {
        PlatformInstrumentDetail d = platform.getInstrumentDetail(id);
        if (d == null) throw ApiException.notFound("Instrument not found: " + id);
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
            .publishedAt(d.getPublishedAt() != null ? d.getPublishedAt() : d.getDateIssued())
            .pdfUrl(d.getPdfUrl())
            .aiSummary(d.getAiSummary())
            .pdfOcrText(d.getPdfOcrText())
            .obligations(d.getObligations() != null ? d.getObligations().stream()
                .map(o -> {
                    var local = localMap.get(o.getObligationNumber() != null ? o.getObligationNumber().toString() : "");
                    return InstrumentDetailResponse.ObligationItem.builder()
                        .obligationId(local != null ? local.getObligationId() : null)
                        .obligationNumber(o.getObligationNumber())
                        .title(o.getTitle())
                        .description(o.getDescription())
                        .plainEnglishStatement(o.getPlainEnglishStatement())
                        .sectionReference(o.getSpecificSectionReference())
                        .areaOfFocus(o.getAreaOfFocus())
                        .obligationType(o.getObligationType())
                        .recurringDeadlineType(o.getRecurringDeadlineType())
                        .riskDescription(o.getRiskDescription())
                        .inherentLikelihood(o.getInherentLikelihood())
                        .inherentImpact(o.getInherentImpact())
                        .inherentRiskRating(o.getInherentRiskRating())
                        .controlOwner(o.getControlOwner())
                        .regulationId(o.getRegulationId())
                        .actName(o.getActName())
                        .effectiveDate(local != null ? local.getEffectiveDate() : null)
                        .status(local != null ? local.getStatus() : "pending")
                        .build();
                })
                .toList() : List.of())
            .sanctions(d.getSanctions() != null ? d.getSanctions().stream()
                .map(s -> InstrumentDetailResponse.SanctionItem.builder()
                    .sanctionType(s.getSanctionType())
                    .amountNaira(s.getAmountNaira())
                    .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                    .liableRoles(s.getLiableRoles())
                    .severityScore(s.getSeverityScore())
                    .hasBeenEnforced(s.getHasBeenEnforced())
                    .description(s.getDescription())
                    .sourceSectionReference(s.getSourceSectionReference())
                    .riskExplanation(s.getRiskExplanation())
                    .penaltyDetails(s.getPenaltyDetails())
                    .regulationId(s.getRegulationId())
                    .actName(s.getActName())
                    .build())
                .toList() : List.of())
            .build();
    }

    public byte[] pdfBytes(Long id) {
        byte[] bytes = platform.getInstrumentPdf(id);
        if (bytes == null || bytes.length == 0)
            throw new DocumentUnavailableException("No document stored for instrument " + id);
        return bytes;
    }

    private InstrumentSummaryResponse toSummary(PlatformInstrumentSummary s, Map<Long, Integer> countMap) {
        return InstrumentSummaryResponse.builder()
            .id(s.getInstrumentId())
            .sourceTitle(s.getSourceTitle())
            .title(s.getSourceTitle())
            .sourceReferenceNumber(s.getSourceReferenceNumber())
            .regulatorAbbreviation(s.getRegulatorAbbreviation())
            .regulatorName(s.getRegulatorName())
            .documentType(s.getDocumentType() != null ? s.getDocumentType() : s.getNature())
            .riskRating(s.getRiskRating())
            .status(s.getStatus())
            .publishedAt(s.getPublishedAt() != null ? s.getPublishedAt() : s.getDateIssued())
            .pdfUrl(s.getPdfUrl())
            .obligationCount(countMap.getOrDefault(s.getInstrumentId(), 0))
            .build();
    }
}
