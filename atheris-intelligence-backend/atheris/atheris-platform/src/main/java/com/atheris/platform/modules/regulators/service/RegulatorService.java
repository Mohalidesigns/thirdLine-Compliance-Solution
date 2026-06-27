package com.atheris.platform.modules.regulators.service;

import com.atheris.common.Constants;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.regulators.dto.*;
import com.atheris.platform.modules.regulators.entity.Regulator;
import com.atheris.platform.modules.regulators.entity.ScraperRunLog;
import com.atheris.platform.modules.regulators.repository.RegulatorRepository;
import com.atheris.platform.modules.regulators.repository.ScraperRunLogRepository;
import com.atheris.platform.modules.regulators.strategy.ScraperRunResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class RegulatorService {

    private final RegulatorRepository repo;
    private final ScraperRunLogRepository scraperLogs;
    private final ScraperService scraperService;
    private final InstrumentRepository instrumentRepo;

    public List<RegulatorDto> findAll(Boolean activeOnly) {
        List<Regulator> list = Boolean.TRUE.equals(activeOnly)
            ? repo.findByIsActiveTrue() : repo.findAll();

        Map<Integer, long[]> stats = buildInstrumentStats();

        return list.stream()
            .map(r -> toDto(r, stats.get(r.getRegulatorId())))
            .toList();
    }

    public List<RegulatorDto> findAllFiltered(Boolean activeOnly, String search) {
        List<RegulatorDto> all = findAll(activeOnly);

        if (search == null || search.isBlank()) return all;

        String q = search.toLowerCase();
        return all.stream()
            .filter(r -> r.getName().toLowerCase().contains(q)
                || r.getAbbreviation().toLowerCase().contains(q))
            .toList();
    }

    public RegulatorDto findById(Integer id) {
        Regulator r = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Regulator not found: " + id));
        Map<Integer, long[]> stats = buildInstrumentStats();
        return toDto(r, stats.get(r.getRegulatorId()));
    }

    @Transactional
    public RegulatorDto create(CreateRegulatorRequest req) {
        Regulator r = Regulator.builder()
            .name(req.getName()).abbreviation(req.getAbbreviation().toUpperCase())
            .websiteUrl(req.getWebsiteUrl())
            .publicationPageUrl(req.getPublicationPageUrl())
            .scraperStrategy(req.getScraperStrategy())
            .scraperFrequency(req.getScraperFrequency())
            .pdfLinkSelector(req.getPdfLinkSelector())
            .paginationEnabled(req.getPaginationEnabled())
            .paginationSelector(req.getPaginationSelector())
            .paginationStrategy(req.getPaginationStrategy())
            .maxPagesPerRun(req.getMaxPagesPerRun())
            .maxPdfSizeMb(req.getMaxPdfSizeMb())
            .scraperEnabled(req.getScraperEnabled())
            .isActive(true).build();
        return toDto(repo.save(r), null);
    }

    @Transactional
    public RegulatorDto update(Integer id, CreateRegulatorRequest req) {
        Regulator r = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Regulator not found: " + id));
        if (req.getName() != null) r.setName(req.getName());
        if (req.getAbbreviation() != null) r.setAbbreviation(req.getAbbreviation().toUpperCase());
        if (req.getWebsiteUrl() != null) r.setWebsiteUrl(req.getWebsiteUrl());
        if (req.getPublicationPageUrl() != null) r.setPublicationPageUrl(req.getPublicationPageUrl());
        if (req.getScraperStrategy() != null) r.setScraperStrategy(req.getScraperStrategy());
        if (req.getScraperFrequency() != null) r.setScraperFrequency(req.getScraperFrequency());
        if (req.getPdfLinkSelector() != null) r.setPdfLinkSelector(req.getPdfLinkSelector());
        if (req.getPaginationEnabled() != null) r.setPaginationEnabled(req.getPaginationEnabled());
        if (req.getPaginationSelector() != null) r.setPaginationSelector(req.getPaginationSelector());
        if (req.getMaxPagesPerRun() != null) r.setMaxPagesPerRun(req.getMaxPagesPerRun());
        if (req.getMaxPdfSizeMb() != null) r.setMaxPdfSizeMb(req.getMaxPdfSizeMb());
        if (req.getScraperEnabled() != null) r.setScraperEnabled(req.getScraperEnabled());
        return toDto(repo.save(r), null);
    }

    @Transactional
    public void deactivate(Integer id) {
        repo.findById(id).ifPresent(r -> { r.setIsActive(false); repo.save(r); });
    }

    public ScraperRunResult testScraper(Integer id, boolean dryRun) {
        Regulator r = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Regulator not found: " + id));
        return scraperService.scrape(r, Constants.MODE_MONITORING);
    }

    public List<ScraperRunLog> getScraperHistory(Integer id) {
        return scraperLogs.findTop30ByRegulatorIdOrderByRunAtDesc(id);
    }

    private Map<Integer, long[]> buildInstrumentStats() {
        List<Object[]> rows = instrumentRepo.getInstrumentStats();
        Map<Integer, long[]> map = new HashMap<>();
        for (Object[] row : rows) {
            Integer regulatorId = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            Instant lastDiscovered = row[2] != null ? (Instant) row[2] : null;
            map.put(regulatorId, new long[]{count, lastDiscovered != null ? lastDiscovered.toEpochMilli() : 0});
        }
        return map;
    }

    private RegulatorDto toDto(Regulator r, long[] stats) {
        return RegulatorDto.builder()
            .regulatorId(r.getRegulatorId()).name(r.getName())
            .abbreviation(r.getAbbreviation()).websiteUrl(r.getWebsiteUrl())
            .publicationPageUrl(r.getPublicationPageUrl())
            .scraperStrategy(r.getScraperStrategy())
            .scraperFrequency(r.getScraperFrequency())
            .pdfLinkSelector(r.getPdfLinkSelector())
            .paginationEnabled(r.getPaginationEnabled())
            .paginationStrategy(r.getPaginationStrategy())
            .maxPagesPerRun(r.getMaxPagesPerRun())
            .maxPdfSizeMb(r.getMaxPdfSizeMb())
            .scraperEnabled(r.getScraperEnabled())
            .isActive(r.getIsActive())
            .scraperLastRanAt(r.getScraperLastRanAt())
            .scraperLastFound(r.getScraperLastFound())
            .scraperNotes(r.getScraperNotes())
            .instrumentCount(stats != null ? (int) stats[0] : 0)
            .lastInstrumentDiscoveredAt(stats != null && stats[1] > 0 ? Instant.ofEpochMilli(stats[1]) : null)
            .build();
    }
}
