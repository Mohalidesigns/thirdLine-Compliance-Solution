package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor
public class RegulationService {

    private final RegulationRepository regulationRepo;
    private final RegulatorRepository regulators;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final RegulatoryReturnRepository returns;

    public Page<RegulationDto> list(String q, Integer regulatorId, Pageable pageable) {
        return regulationRepo.findAll((root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (q != null && !q.isBlank())
                predicates.add(cb.like(cb.lower(root.get("name")), "%" + q.toLowerCase() + "%"));
            if (regulatorId != null)
                predicates.add(cb.equal(root.get("regulatorId"), regulatorId));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        }, pageable).map(this::toDto);
    }

    public RegulationDetailDto detail(Long id) {
        Regulation reg = regulationRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Regulation not found: " + id));
        List<Instrument> insts = instruments.findAll().stream()
            .filter(i -> reg.getRegulationId().equals(i.getRegulationId()))
            .toList();
        List<ObligationMapping> obls = obligations.findByRegulationId(id);
        List<SanctionsPenalty> sans = sanctions.findByRegulationId(id);
        List<RegulatoryReturn> rets = returns.findByActId(id);
        String regName = reg.getRegulatorId() != null
            ? regulators.findById(reg.getRegulatorId()).map(r -> r.getName()).orElse(null)
            : null;
        return RegulationDetailDto.builder()
            .regulationId(reg.getRegulationId())
            .name(reg.getName())
            .abbreviation(reg.getAbbreviation())
            .description(reg.getDescription())
            .regulatorId(reg.getRegulatorId())
            .regulatorName(regName)
            .status(reg.getStatus())
            .instrumentCount(insts.size())
            .obligationCount(obls.size())
            .sanctionCount(sans.size())
            .returnCount(rets.size())
            .instruments(insts.stream().map(i -> RegulationDetailDto.InstrumentItem.builder()
                .instrumentId(i.getInstrumentId())
                .sourceTitle(i.getSourceTitle())
                .nature(i.getNature())
                .areaOfFocus(i.getAreaOfFocus())
                .riskRating(i.getRiskRating())
                .dateIssued(i.getDateIssued())
                .status(i.getStatus())
                .hasPdf(i.getPdfUrl() != null)
                .documentUrl(i.getDocumentUrl())
                .build()).toList())
            .obligations(obls.stream().map(o -> RegulationDetailDto.ObligationItem.builder()
                .obligationId(o.getObligationId())
                .sectionReference(o.getSpecificSectionReference())
                .statement(o.getPlainEnglishStatement())
                .type(o.getObligationType())
                .recurringDeadline(o.getRecurringDeadlineType())
                .build()).toList())
            .sanctions(sans.stream().map(s -> RegulationDetailDto.SanctionItem.builder()
                .sanctionId(s.getSanctionId())
                .sanctionType(s.getSanctionType())
                .amountNaira(s.getSanctionAmountNaira())
                .amountPerDay(s.getSanctionAmountPerDay())
                .liableRoles(s.getLiableRoles())
                .description(s.getDescription())
                .sectionReference(s.getSourceSectionReference())
                .riskExplanation(s.getRiskExplanation())
                .penaltyDetails(s.getPenaltyDetails())
                .build()).toList())
            .returns(rets.stream().map(rt -> RegulationDetailDto.ReturnItem.builder()
                .returnId(rt.getReturnId())
                .title(rt.getTitle())
                .sectionReference(rt.getSectionReference())
                .statutoryBasis(rt.getStatutoryBasis())
                .responsibleUnit(rt.getResponsibleUnit())
                .responsiblePerson(rt.getResponsiblePerson())
                .frequency(rt.getFrequency())
                .deadline(rt.getDeadline())
                .filingDate(rt.getFilingDate())
                .build()).toList())
            .build();
    }

    @Transactional
    public RegulationDto update(Long id, RegulationDto req) {
        Regulation reg = regulationRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Regulation not found: " + id));
        if (req.getName() != null) reg.setName(req.getName());
        if (req.getAbbreviation() != null) reg.setAbbreviation(req.getAbbreviation());
        if (req.getDescription() != null) reg.setDescription(req.getDescription());
        if (req.getRegulatorId() != null) reg.setRegulatorId(req.getRegulatorId());
        if (req.getStatus() != null) reg.setStatus(req.getStatus());
        return toDto(regulationRepo.save(reg));
    }

    public Map<String, Object> stats() {
        long totalActs = regulationRepo.count();
        long totalInstruments = instruments.count();
        long totalObligations = obligations.count();
        long totalSanctions = sanctions.count();
        long totalReturns = returns.count();
        long activeCount = regulationRepo.findAll().stream().filter(r -> "Active".equals(r.getStatus())).count();
        long supersededCount = totalActs - activeCount;
        List<String> regulatorNames = regulationRepo.findAll().stream()
            .map(r -> r.getRegulatorId())
            .distinct()
            .map(id -> regulators.findById(id).map(x -> x.getName()).orElse(null))
            .filter(java.util.Objects::nonNull)
            .sorted()
            .toList();
        return Map.of(
            "totalActs", totalActs,
            "totalInstruments", totalInstruments,
            "totalObligations", totalObligations,
            "totalSanctions", totalSanctions,
            "totalReturns", totalReturns,
            "activeCount", activeCount,
            "supersededCount", supersededCount,
            "regulators", regulatorNames
        );
    }

    private RegulationDto toDto(Regulation r) {
        return RegulationDto.builder()
            .regulationId(r.getRegulationId())
            .name(r.getName())
            .abbreviation(r.getAbbreviation())
            .description(r.getDescription())
            .regulatorId(r.getRegulatorId())
            .regulatorName(r.getRegulatorId() != null
                ? regulators.findById(r.getRegulatorId()).map(x -> x.getName()).orElse(null)
                : null)
            .status(r.getStatus())
            .instrumentCount(instruments.countByRegulationId(r.getRegulationId()))
            .obligationCount(obligations.countByRegulationId(r.getRegulationId()))
            .sanctionCount(sanctions.countByRegulationId(r.getRegulationId()))
            .returnCount(returns.countByActId(r.getRegulationId()))
            .build();
    }
}