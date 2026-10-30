package com.atheris.compliance.tenant.backend.modules.acts.service;

import com.atheris.compliance.tenant.backend.modules.acts.dto.ActDetailResponse;
import com.atheris.compliance.tenant.backend.modules.acts.dto.ActListItem;
import com.atheris.compliance.tenant.backend.modules.acts.dto.ActStatsDto;
import com.atheris.compliance.tenant.backend.modules.acts.entity.Act;
import com.atheris.compliance.tenant.backend.modules.acts.repository.ActRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Read-only view over the tenant's acts: the browsable list with linked-record counts, the
 * KPI stats, and one act's detail. Counts reuse the existing repositories (obligations are
 * instrument-keyed; controls/returns/sanctions are act-keyed).
 */
@Service
@RequiredArgsConstructor
public class ActService {

    private final ActRepository acts;
    private final ObligationRepository obligations;
    private final ControlRepository controls;
    private final RegulatoryReturnRepository returns;
    private final RegulatorySanctionRepository sanctions;

    /** {@code inRegister}: only acts whose instrument has obligations in this tenant's register. */
    public Page<ActListItem> list(String q, String regulator, Boolean inRegister, Pageable pageable) {
        java.util.Set<Long> registerInstruments = Boolean.TRUE.equals(inRegister)
            ? new java.util.HashSet<>(obligations.findDistinctInstrumentIds()) : null;
        return acts.findAll(spec(q, regulator, registerInstruments), pageable).map(this::toItem);
    }

    public ActDetailResponse detail(Integer id) {
        Act a = acts.findById(id)
            .orElseThrow(() -> new java.util.NoSuchElementException("Act not found: " + id));
        return ActDetailResponse.builder()
            .actId(a.getActId())
            .regulationId(a.getRegulationId())
            .name(a.getName())
            .abbreviation(a.getAbbreviation())
            .regulatorName(a.getRegulatorName())
            .canonicalInstrumentId(a.getCanonicalInstrumentId())
            .obligationCount(obligationCount(a))
            .controlCount(controlCount(a))
            .returnCount(returnCount(a))
            .sanctionCount(sanctionCount(a))
            .build();
    }

    public ActStatsDto stats() {
        List<Act> all = acts.findAll();
        Map<String, Long> byRegulator = new TreeMap<>();
        for (Act a : all) {
            String key = a.getRegulatorName() == null || a.getRegulatorName().isBlank()
                ? "Unspecified" : a.getRegulatorName();
            byRegulator.merge(key, 1L, Long::sum);
        }
        java.util.Set<Long> registerInstruments = new java.util.HashSet<>(obligations.findDistinctInstrumentIds());
        long inRegister = all.stream().filter(a -> a.getCanonicalInstrumentId() != null
            && registerInstruments.contains(a.getCanonicalInstrumentId())).count();
        return ActStatsDto.builder()
            .totalActs(all.size())
            .actsInRegister(inRegister)
            .byRegulator(new LinkedHashMap<>(byRegulator))
            .regulators(List.copyOf(byRegulator.keySet()))
            .build();
    }

    // ── helpers ──

    private ActListItem toItem(Act a) {
        return ActListItem.builder()
            .actId(a.getActId())
            .regulationId(a.getRegulationId())
            .name(a.getName())
            .abbreviation(a.getAbbreviation())
            .regulatorName(a.getRegulatorName())
            .obligationCount(obligationCount(a))
            .controlCount(controlCount(a))
            .returnCount(returnCount(a))
            .sanctionCount(sanctionCount(a))
            .build();
    }

    private long obligationCount(Act a) {
        return a.getCanonicalInstrumentId() == null ? 0 : obligations.countByInstrumentId(a.getCanonicalInstrumentId());
    }

    private long controlCount(Act a) {
        return a.getRegulationId() == null ? 0 : controls.countByActId(a.getRegulationId().intValue());
    }

    private long returnCount(Act a) {
        return a.getRegulationId() == null ? 0 : returns.countByActId(a.getRegulationId());
    }

    private long sanctionCount(Act a) {
        return a.getRegulationId() == null ? 0 : sanctions.countByRegulationId(a.getRegulationId());
    }

    private Specification<Act> spec(String q, String regulator, java.util.Set<Long> instrumentIds) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (instrumentIds != null) {
                if (instrumentIds.isEmpty()) return cb.disjunction();
                predicates.add(root.get("canonicalInstrumentId").in(instrumentIds));
            }
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("abbreviation")), like)));
            }
            if (regulator != null && !regulator.isBlank()) {
                predicates.add(cb.equal(root.get("regulatorName"), regulator));
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
