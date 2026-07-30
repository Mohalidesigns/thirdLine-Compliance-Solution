package com.atheris.compliance.intelligence.backend.modules.internal.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentDetail;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalInstrumentSummary;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.common.Constants;
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

import java.time.LocalDate;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class InternalInstrumentService {

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final StorageService storage;
    private final RegulatorRepository regulators;

    public Page<InternalInstrumentSummary> findRecentForTenant(Long tenantId, List<Integer> regulatorIds,
                                                                String licenceType, LocalDate since, Pageable pageable) {
        if (regulatorIds.isEmpty()) return Page.empty();

        Specification<Instrument> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), Constants.INST_PUBLISHED));
            predicates.add(root.get("regulatorId").in(regulatorIds));
            if (since != null)
                predicates.add(cb.greaterThan(root.get("publishedAt"), since));
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
            .obligations(obligations.findByInstrumentId(instrumentId).stream()
                .map(o -> InternalInstrumentDetail.ObligationItem.builder()
                    .obligationNumber(o.getObligationNumber())
                    .plainEnglishStatement(o.getPlainEnglishStatement())
                    .specificSectionReference(o.getSpecificSectionReference())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .build())
                .toList())
            .sanctions(sanctions.findByInstrumentId(instrumentId).stream()
                .map(s -> InternalInstrumentDetail.SanctionItem.builder()
                    .sanctionType(s.getSanctionType())
                    .amountNaira(s.getSanctionAmountNaira())
                    .liableRoles(s.getLiableRoles())
                    .severityScore(s.getSeverityScore())
                    .hasBeenEnforced(s.getHasBeenEnforced())
                    .build())
                .toList())
            .build();
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
}
