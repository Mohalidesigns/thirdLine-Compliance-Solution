package com.atheris.compliance.intelligence.backend.modules.pipeline.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.pending.entity.PendingDownload;
import com.atheris.compliance.intelligence.backend.modules.pending.repository.PendingDownloadRepository;
import com.atheris.compliance.intelligence.backend.modules.pipeline.dto.PipelineItemDto;
import com.atheris.compliance.intelligence.backend.modules.pipeline.dto.PipelineStatsDto;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.function.Predicate;

/**
 * The AI document pipeline is everything that is NOT toolkit-seeded. Toolkit instruments
 * bypass the pipeline entirely (they are written straight to the tenant Register), so they
 * are excluded from both the list and the KPIs.
 *
 * One row = one document. Rows are the non-toolkit instruments plus failed download attempts
 * (pending_downloads rows carrying an error message).
 */
@Service
@RequiredArgsConstructor
public class PipelineService {

    private final InstrumentRepository instruments;
    private final PendingDownloadRepository pending;
    private final RegulatorRepository regulators;

    public record PipelinePage(List<PipelineItemDto> rows, long total) {}

    public PipelinePage list(String q, Integer regulatorId, String stage,
                             LocalDate discoveredFrom, LocalDate discoveredTo,
                             int page, int size) {
        Map<Integer, String> regAbbr = regulatorAbbreviations();
        List<PipelineItemDto> all = new ArrayList<>();
        for (Instrument i : instruments.findAll()) {
            if (Constants.UPLOAD_SOURCE_TOOLKIT.equals(i.getUploadSource())) continue;
            all.add(fromInstrument(i, regAbbr));
        }
        for (PendingDownload p : pending.findFailedDownloads()) {
            all.add(fromFailedDownload(p, regAbbr));
        }

        Predicate<PipelineItemDto> filter = Predicates.build(q, regulatorId, stage, discoveredFrom, discoveredTo);
        List<PipelineItemDto> filtered = new ArrayList<>(all.stream().filter(filter).toList());
        filtered.sort(Comparator.comparing(PipelineItemDto::getDiscoveredAt,
            Comparator.nullsLast(Comparator.reverseOrder())));

        long total = filtered.size();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        return new PipelinePage(filtered.subList(from, to), total);
    }

    public PipelineStatsDto stats() {
        Map<Integer, String> regAbbr = regulatorAbbreviations();
        List<Instrument> ai = instruments.findAll().stream()
            .filter(i -> !Constants.UPLOAD_SOURCE_TOOLKIT.equals(i.getUploadSource()))
            .toList();
        List<PendingDownload> failed = pending.findFailedDownloads();

        long successful = ai.size();
        long completed = ai.stream()
            .filter(i -> Constants.INST_PUBLISHED.equals(i.getStatus()))
            .count();

        Map<String, Long> byRegulator = new TreeMap<>();
        Map<String, Long> byStage = new TreeMap<>();
        for (Instrument i : ai) {
            bump(byRegulator, regAbbr.getOrDefault(i.getRegulatorId(), "Unassigned"));
            bump(byStage, stageOf(i.getStatus()));
        }
        for (PendingDownload p : failed) {
            bump(byRegulator, regAbbr.getOrDefault(p.getRegulatorId(), "Unassigned"));
            bump(byStage, "failed");
        }

        return PipelineStatsDto.builder()
            .totalDownloads(successful + failed.size())
            .successfulDownloads(successful)
            .failedDownloads(failed.size())
            .completed(completed)
            .byRegulator(byRegulator)
            .byStage(byStage)
            .build();
    }

    private PipelineItemDto fromInstrument(Instrument i, Map<Integer, String> regAbbr) {
        return PipelineItemDto.builder()
            .id("inst-" + i.getInstrumentId())
            .type("instrument")
            .instrumentId(i.getInstrumentId())
            .title(i.getSourceTitle() != null ? i.getSourceTitle() : "Untitled document")
            .reference(i.getSourceReferenceNumber())
            .regulatorId(i.getRegulatorId())
            .regulatorAbbreviation(regulatorLabel(i.getRegulatorId(), regAbbr))
            .stage(stageOf(i.getStatus()))
            .status(i.getStatus())
            .discoveredAt(i.getDiscoveredAt())
            .build();
    }

    private PipelineItemDto fromFailedDownload(PendingDownload p, Map<Integer, String> regAbbr) {
        return PipelineItemDto.builder()
            .id("pd-" + p.getId())
            .type("failed_download")
            .pendingId(p.getId())
            .title(p.getTitle() != null ? p.getTitle() : "Untitled document")
            .regulatorId(p.getRegulatorId())
            .regulatorAbbreviation(regulatorLabel(p.getRegulatorId(), regAbbr))
            .stage("failed")
            .status("failed")
            .discoveredAt(p.getDiscoveredAt())
            .errorMessage(p.getErrorMessage())
            .build();
    }

    private String regulatorLabel(Integer regulatorId, Map<Integer, String> regAbbr) {
        if (regulatorId == null) return "—";
        return regAbbr.getOrDefault(regulatorId, "Regulator #" + regulatorId);
    }

    private static String stageOf(String status) {
        if (Constants.INST_PUBLISHED.equals(status)) return "published";
        if (Constants.INST_TRIAGE.equals(status)) return "extracting";
        if (Constants.INST_SUPERSEDED.equals(status)) return "superseded";
        if (Constants.INST_WITHDRAWN.equals(status)) return "withdrawn";
        return "classified";
    }

    private Map<Integer, String> regulatorAbbreviations() {
        Map<Integer, String> map = new HashMap<>();
        for (Regulator r : regulators.findAll()) {
            map.put(r.getRegulatorId(), r.getAbbreviation() != null ? r.getAbbreviation() : r.getName());
        }
        return map;
    }

    private static void bump(Map<String, Long> map, String key) {
        map.merge(key, 1L, Long::sum);
    }

    private static final class Predicates {
        static Predicate<PipelineItemDto> build(String q, Integer regulatorId, String stage,
                                                 LocalDate from, LocalDate to) {
            return item -> {
                if (regulatorId != null && !regulatorId.equals(item.getRegulatorId())) return false;
                if (stage != null && !stage.isBlank() && !stage.equals(item.getStage())) return false;
                if (q != null && !q.isBlank()) {
                    String needle = q.trim().toLowerCase();
                    String title = item.getTitle() != null ? item.getTitle().toLowerCase() : "";
                    String ref = item.getReference() != null ? item.getReference().toLowerCase() : "";
                    if (!title.contains(needle) && !ref.contains(needle)) return false;
                }
                LocalDate discovered = item.getDiscoveredAt() != null
                    ? item.getDiscoveredAt().atZone(ZoneOffset.UTC).toLocalDate() : null;
                if (from != null && (discovered == null || discovered.isBefore(from))) return false;
                if (to != null && (discovered == null || discovered.isAfter(to))) return false;
                return true;
            };
        }
    }
}