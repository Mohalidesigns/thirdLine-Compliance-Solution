package com.atheris.compliance.intelligence.backend.modules.internal.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.intelligence.backend.shared.storage.StorageService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class InternalInstrumentService {

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final StorageService storage;
    private final RegulatorRepository regulators;
    private final RegulationRepository actRepository;

    public Page<InternalInstrumentSummary> findRecentForTenant(Long tenantId, List<Integer> regulatorIds,
                                                                 String licenceType, LocalDate since, Pageable pageable) {
        if (regulatorIds.isEmpty()) return Page.empty();

        Specification<Instrument> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), Constants.INST_PUBLISHED));
            predicates.add(root.get("regulatorId").in(regulatorIds));
            if (since != null) {
                jakarta.persistence.criteria.Expression<LocalDate> effectiveDate =
                        cb.coalesce(root.get("publishedAt"), root.get("dateIssued"));
                Predicate datePredicate = cb.greaterThan(effectiveDate, since);
                Predicate nullDatePredicate = cb.and(
                        cb.isNull(root.get("publishedAt")),
                        cb.isNull(root.get("dateIssued")));
                predicates.add(cb.or(datePredicate, nullDatePredicate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Instrument> page = instruments.findAll(spec, pageable);
        List<InternalInstrumentSummary> filtered = page.getContent().stream()
            .map(this::toSummary)
            .toList();

        return new PageImpl<>(filtered, pageable, page.getTotalElements());
    }

    public Page<InternalInstrumentSummary> searchInstruments(String q, List<Integer> regulatorIds, Pageable pageable) {
        Specification<Instrument> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("sourceTitle")), "%" + q.toLowerCase() + "%"));
            }
            if (regulatorIds != null && !regulatorIds.isEmpty()) {
                predicates.add(root.get("regulatorId").in(regulatorIds));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return instruments.findAll(spec, pageable).map(this::toSummary);
    }

    public InternalInstrumentDetail getFullDetail(Long instrumentId) {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + instrumentId));

        String regName = null, regAbbr = null;
        if (inst.getRegulatorId() != null) {
            Optional<Regulator> r = regulators.findById(inst.getRegulatorId());
            if (r.isPresent()) {
                regName = r.get().getName();
                regAbbr = r.get().getAbbreviation();
            }
        }

        List<ObligationMapping> obList = obligations.findByInstrumentId(instrumentId);
        List<SanctionsPenalty> sanList = sanctions.findByInstrumentId(instrumentId);
        Map<Long, String> actNameMap = buildActNameMap(obList, sanList);

        return InternalInstrumentDetail.builder()
            .instrumentId(inst.getInstrumentId())
            .sourceTitle(inst.getSourceTitle())
            .sourceReferenceNumber(inst.getSourceReferenceNumber())
            .regulatorId(inst.getRegulatorId())
            .regulatorName(regName)
            .regulatorAbbreviation(regAbbr)
            .dateIssued(inst.getDateIssued())
            .dateCommencement(inst.getDateCommencement())
            .riskRating(inst.getRiskRating())
            .nature(inst.getNature())
            .areaOfFocus(inst.getAreaOfFocus())
            .aiSummary(inst.getAiSummary())
            .pdfUrl(storage.generatePresignedUrl(inst.getPdfUrl(), 3600))
            .pdfOcrText(inst.getPdfOcrText())
            .publishedAt(inst.getPublishedAt())
            .status(inst.getStatus())
            .obligations(obList.stream().map(o -> toObligationItem(o, actNameMap)).toList())
            .sanctions(sanList.stream().map(s -> toSanctionItem(s, actNameMap)).toList())
            .build();
    }

    public InputStream openPdfStream(Long instrumentId) throws IOException {
        Instrument inst = instruments.findById(instrumentId)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + instrumentId));
        return storage.openReadStream(inst.getPdfUrl());
    }

    public Map<Long, InternalInstrumentDetail> getBatchDetail(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        List<Instrument> found = instruments.findAllById(ids);

        Set<Integer> regulatorIds = found.stream().map(Instrument::getRegulatorId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Integer, Regulator> regMap = regulators.findAllById(regulatorIds).stream()
            .collect(Collectors.toMap(Regulator::getRegulatorId, r -> r));

        Map<Long, List<ObligationMapping>> obMap =
            obligations.findByInstrumentIdIn(ids).stream()
                .collect(Collectors.groupingBy(ObligationMapping::getInstrumentId));

        Map<Long, List<SanctionsPenalty>> sanMap =
            sanctions.findByInstrumentIdIn(ids).stream()
                .collect(Collectors.groupingBy(SanctionsPenalty::getInstrumentId));

        // batch act names for all obligations + sanctions across the batch
        List<ObligationMapping> allObs = obMap.values().stream().flatMap(List::stream).toList();
        List<SanctionsPenalty> allSans = sanMap.values().stream().flatMap(List::stream).toList();
        Map<Long, String> actNameMap = buildActNameMap(allObs, allSans);

        Map<Long, InternalInstrumentDetail> result = new LinkedHashMap<>();
        for (Instrument inst : found) {
            Regulator reg = inst.getRegulatorId() != null ? regMap.get(inst.getRegulatorId()) : null;
            List<ObligationMapping> instOb = obMap.getOrDefault(inst.getInstrumentId(), List.of());
            List<SanctionsPenalty> instSan = sanMap.getOrDefault(inst.getInstrumentId(), List.of());
            result.put(inst.getInstrumentId(), InternalInstrumentDetail.builder()
                .instrumentId(inst.getInstrumentId())
                .sourceTitle(inst.getSourceTitle())
                .sourceReferenceNumber(inst.getSourceReferenceNumber())
                .regulatorId(inst.getRegulatorId())
                .regulatorName(reg != null ? reg.getName() : null)
                .regulatorAbbreviation(reg != null ? reg.getAbbreviation() : null)
                .dateIssued(inst.getDateIssued())
                .dateCommencement(inst.getDateCommencement())
                .riskRating(inst.getRiskRating())
                .nature(inst.getNature())
                .areaOfFocus(inst.getAreaOfFocus())
                .aiSummary(inst.getAiSummary())
                .pdfUrl(storage.generatePresignedUrl(inst.getPdfUrl(), 3600))
                .pdfOcrText(inst.getPdfOcrText())
                .publishedAt(inst.getPublishedAt())
                .status(inst.getStatus())
                .obligations(instOb.stream().map(o -> toObligationItem(o, actNameMap)).toList())
                .sanctions(instSan.stream().map(s -> toSanctionItem(s, actNameMap)).toList())
                .build());
        }
        return result;
    }

    private InternalInstrumentDetail.ObligationItem toObligationItem(ObligationMapping o, Map<Long, String> actNameMap) {
        return InternalInstrumentDetail.ObligationItem.builder()
            .obligationNumber(o.getObligationNumber())
            .title(shorten(o.getTitle(), 500))
            .description(o.getDescription())
            .plainEnglishStatement(shorten(o.getPlainEnglishStatement(), 500))
            .specificSectionReference(shorten(o.getSpecificSectionReference(), 100))
            .areaOfFocus(o.getAreaOfFocus())
            .obligationType(o.getObligationType())
            .recurringDeadlineType(o.getRecurringDeadlineType())
            .riskDescription(o.getRiskDescription())
            .inherentLikelihood(o.getInherentLikelihood())
            .inherentImpact(o.getInherentImpact())
            .inherentRiskRating(o.getInherentRiskRating())
            .controlOwner(shorten(o.getControlOwner(), 500))
            .regulationId(o.getRegulationId())
            .actName(o.getRegulationId() != null ? actNameMap.get(o.getRegulationId()) : null)
            .build();
    }

    private InternalInstrumentDetail.SanctionItem toSanctionItem(SanctionsPenalty s, Map<Long, String> actNameMap) {
        return InternalInstrumentDetail.SanctionItem.builder()
            .sanctionType(s.getSanctionType())
            .amountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
            .liableRoles(s.getLiableRoles())
            .severityScore(s.getSeverityScore())
            .hasBeenEnforced(s.getHasBeenEnforced())
            .description(s.getDescription())
            .sourceSectionReference(s.getSourceSectionReference())
            .riskExplanation(s.getRiskExplanation())
            .penaltyDetails(s.getPenaltyDetails())
            .regulationId(s.getRegulationId())
            .actName(s.getRegulationId() != null ? actNameMap.get(s.getRegulationId()) : null)
            .build();
    }

    private Map<Long, String> buildActNameMap(List<ObligationMapping> obs, List<SanctionsPenalty> sans) {
        Set<Long> ids = new HashSet<>();
        for (ObligationMapping o : obs) if (o.getRegulationId() != null) ids.add(o.getRegulationId());
        for (SanctionsPenalty s : sans) if (s.getRegulationId() != null) ids.add(s.getRegulationId());
        if (ids.isEmpty()) return Map.of();
        try {
            return actRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Regulation::getRegulationId, Regulation::getName, (a, b) -> a));
        } catch (Exception e) {
            log.warn("Failed to fetch act names for {} ids: {}", ids.size(), e.getMessage());
            return Map.of();
        }
    }

    private InternalInstrumentSummary toSummary(Instrument i) {
        String regName = null, regAbbr = null;
        if (i.getRegulatorId() != null) {
            Optional<Regulator> r = regulators.findById(i.getRegulatorId());
            if (r.isPresent()) {
                regName = r.get().getName();
                regAbbr = r.get().getAbbreviation();
            }
        }
        return InternalInstrumentSummary.builder()
            .instrumentId(i.getInstrumentId())
            .sourceTitle(i.getSourceTitle())
            .sourceReferenceNumber(i.getSourceReferenceNumber())
            .regulatorId(i.getRegulatorId())
            .regulatorName(regName)
            .regulatorAbbreviation(regAbbr)
            .dateIssued(i.getDateIssued())
            .riskRating(i.getRiskRating())
            .nature(i.getNature())
            .areaOfFocus(i.getAreaOfFocus())
            .aiSummary(i.getAiSummary())
            .status(i.getStatus())
            .documentType(i.getNature())
            .publishedAt(i.getPublishedAt())
            .pdfUrl(storage.generatePresignedUrl(i.getPdfUrl(), 3600))
            .build();
    }

    private static String shorten(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max);
    }
}
