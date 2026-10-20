package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.modules.acts.entity.Act;
import com.atheris.compliance.tenant.backend.modules.acts.repository.ActRepository;
import com.atheris.compliance.tenant.backend.modules.onboarding.dto.RegulatorSummary;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.CreateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.RegulatorStatsDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.TenantRegulatorDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UpdateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.mapper.TenantRegulatorMapper;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class RegulatorService {

    private final TenantRegulatorRepository repo;
    private final TenantRegulatorMapper mapper;
    private final TenantProfileRepository profiles;
    private final PlatformApiClient platform;
    private final TenantIdentityService tenantIdentity;
    private final ObligationRepository obligations;
    private final RegulatoryReturnRepository returns;
    private final RegulatorySanctionRepository sanctions;
    private final ActRepository acts;
    private final EntityManager em;

    public Page<TenantRegulatorDto> list(String search, Boolean active, Pageable pageable) {
        syncFromProfile();
        Long tenantId = tenantIdentity.currentTenantId();
        Specification<TenantRegulator> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), tenantId));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("abbreviation")), like)));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("isActive"), active));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<TenantRegulator> page = repo.findAll(spec, pageable);

        List<Long> pageIds = page.getContent().stream().map(TenantRegulator::getId).toList();
        Map<Long, Long> obligationCounts = pageIds.isEmpty() ? Map.of() : countObligationsByRegulator(pageIds);
        Map<Long, Long> returnCounts = pageIds.isEmpty() ? Map.of() : countReturnsByRegulator(pageIds);
        Map<Long, Long> sanctionCounts = pageIds.isEmpty() ? Map.of() : countSanctionsByRegulator(page.getContent());

        return page.map(e -> {
            TenantRegulatorDto dto = mapper.toDto(e);
            dto.setObligationCount(obligationCounts.getOrDefault(e.getId(), 0L));
            dto.setReturnCount(returnCounts.getOrDefault(e.getId(), 0L));
            dto.setSanctionCount(sanctionCounts.getOrDefault(e.getId(), 0L));
            return dto;
        });
    }

    /** Register summary: Total · Sanctions · Obligations · Returns, each with a per-regulator breakdown. */
    public RegulatorStatsDto stats() {
        syncFromProfile();
        Long tenantId = tenantIdentity.currentTenantId();
        List<TenantRegulator> all = repo.findByTenantId(tenantId, Pageable.unpaged()).getContent();

        List<Long> regIds = all.stream().map(TenantRegulator::getId).toList();
        Map<Long, Long> obligationCounts = regIds.isEmpty() ? Map.of() : countObligationsByRegulator(regIds);
        Map<Long, Long> returnCounts = regIds.isEmpty() ? Map.of() : countReturnsByRegulator(regIds);
        Map<Long, Long> sanctionCounts = regIds.isEmpty() ? Map.of() : countSanctionsByRegulator(all);

        long totalObligations = 0;
        long totalReturns = 0;
        long totalSanctions = 0;
        Map<String, Long> totalBreakdown = new LinkedHashMap<>();
        Map<String, Long> obligationsBreakdown = new LinkedHashMap<>();
        Map<String, Long> returnsBreakdown = new LinkedHashMap<>();
        Map<String, Long> sanctionsBreakdown = new LinkedHashMap<>();

        for (TenantRegulator r : all) {
            String label = r.getAbbreviation() != null && !r.getAbbreviation().isBlank()
                ? r.getAbbreviation() : r.getName();
            long ob = obligationCounts.getOrDefault(r.getId(), 0L);
            long rt = returnCounts.getOrDefault(r.getId(), 0L);
            long sn = sanctionCounts.getOrDefault(r.getId(), 0L);
            totalObligations += ob;
            totalReturns += rt;
            totalSanctions += sn;
            totalBreakdown.put(label, 1L);
            if (ob > 0) {
                obligationsBreakdown.put(label, ob);
            }
            if (rt > 0) {
                returnsBreakdown.put(label, rt);
            }
            if (sn > 0) {
                sanctionsBreakdown.put(label, sn);
            }
        }

        return RegulatorStatsDto.builder()
            .total(all.size())
            .sanctions(totalSanctions)
            .obligations(totalObligations)
            .returns(totalReturns)
            .totalBreakdown(totalBreakdown)
            .sanctionsBreakdown(sanctionsBreakdown)
            .obligationsBreakdown(obligationsBreakdown)
            .returnsBreakdown(returnsBreakdown)
            .build();
    }

    private Map<Long, Long> countObligationsByRegulator(List<Long> regulatorIds) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<Obligation> root = cq.from(Obligation.class);
        Path<Long> regId = root.get("tenantRegulatorId");
        cq.multiselect(regId.alias("regId"), cb.count(root).alias("cnt"));
        cq.where(regId.in(regulatorIds));
        cq.groupBy(regId);
        Map<Long, Long> out = new HashMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            out.put(t.get("regId", Long.class), t.get("cnt", Long.class));
        }
        return out;
    }

    private Map<Long, Long> countReturnsByRegulator(List<Long> regulatorIds) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<RegulatoryReturn> root = cq.from(RegulatoryReturn.class);
        Path<Long> regId = root.get("tenantRegulatorId");
        cq.multiselect(regId.alias("regId"), cb.count(root).alias("cnt"));
        cq.where(regId.in(regulatorIds));
        cq.groupBy(regId);
        Map<Long, Long> out = new HashMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            out.put(t.get("regId", Long.class), t.get("cnt", Long.class));
        }
        return out;
    }

    /**
     * Sanctions link to an act, and an act links to a platform regulator id, so sanctions per
     * tenant regulator are resolved through the acts table (two-hop, grouped in SQL).
     */
    private Map<Long, Long> countSanctionsByRegulator(List<TenantRegulator> regulators) {
        Map<Integer, Long> regIdByPlatform = new HashMap<>();
        List<Integer> platformIds = new ArrayList<>();
        for (TenantRegulator r : regulators) {
            if (r.getPlatformRegulatorId() != null) {
                regIdByPlatform.put(r.getPlatformRegulatorId(), r.getId());
                platformIds.add(r.getPlatformRegulatorId());
            }
        }
        if (platformIds.isEmpty()) {
            return Map.of();
        }

        List<Act> regulatorActs = acts.findByRegulatorIdIn(platformIds);
        Map<Long, Integer> platformRegByAct = new HashMap<>();
        List<Long> regulationIds = new ArrayList<>();
        for (Act a : regulatorActs) {
            if (a.getRegulatorId() != null && a.getRegulationId() != null) {
                platformRegByAct.put(a.getRegulationId(), a.getRegulatorId());
                regulationIds.add(a.getRegulationId());
            }
        }
        if (regulationIds.isEmpty()) {
            return Map.of();
        }

        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<RegulatorySanction> root = cq.from(RegulatorySanction.class);
        Path<Long> actId = root.get("regulationId");
        cq.multiselect(actId.alias("actId"), cb.count(root).alias("cnt"));
        cq.where(actId.in(regulationIds));
        cq.groupBy(actId);

        Map<Long, Long> out = new HashMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            Long regulationId = t.get("actId", Long.class);
            Integer platformReg = platformRegByAct.get(regulationId);
            if (platformReg == null) {
                continue;
            }
            Long tenantRegId = regIdByPlatform.get(platformReg);
            if (tenantRegId == null) {
                continue;
            }
            out.merge(tenantRegId, t.get("cnt", Long.class), Long::sum);
        }
        return out;
    }

    @Transactional
    public void syncFromProfile() {
        Long tenantId = tenantIdentity.currentTenantId();
        profiles.findByTenantId(tenantId).ifPresent(p -> {
            // tenant_regulators is the union of the two onboarding selections: intelligence
            // regulators (Review Inbox) and toolkit regulators (Obligations Register).
            List<Integer> subscribed = new ArrayList<>();
            if (p.getSubscribedRegulators() != null) subscribed.addAll(p.getSubscribedRegulators());
            if (p.getToolkitRegulators() != null) subscribed.addAll(p.getToolkitRegulators());
            subscribed = subscribed.stream().filter(java.util.Objects::nonNull).distinct().toList();
            if (subscribed.isEmpty()) {
                return;
            }

            List<TenantRegulator> existing = repo.findByTenantIdAndIsActiveTrue(tenantId);
            long existingCount = existing.size();
            if (existingCount >= subscribed.size()) {
                return;
            }

            List<RegulatorSummary> allRegs = platform.fetchRegulators();

            for (Integer regId : subscribed) {
                boolean alreadyExists = existing.stream()
                    .anyMatch(e -> regId.equals(e.getPlatformRegulatorId()));
                if (alreadyExists) {
                    continue;
                }

                String name = null;
                String abbr = null;
                if (allRegs != null) {
                    RegulatorSummary s = allRegs.stream()
                        .filter(r -> regId.equals(r.getRegulatorId()))
                        .findFirst().orElse(null);
                    if (s != null) {
                        name = s.getName();
                        abbr = s.getAbbreviation();
                    }
                }
                if (name == null) {
                    name = "Regulator " + regId;
                }

                repo.save(TenantRegulator.builder()
                    .tenantId(tenantId).name(name).abbreviation(abbr)
                    .platformRegulatorId(regId).isActive(true).build());
                log.info("Auto-created TenantRegulator for platform regulator {}", regId);
            }
        });
    }

    public TenantRegulatorDto getById(Long id) {
        Long tenantId = tenantIdentity.currentTenantId();
        return repo.findByIdAndTenantId(id, tenantId)
            .map(entity -> {
                TenantRegulatorDto dto = mapper.toDto(entity);
                dto.setObligationCount(obligations.countByTenantRegulatorId(entity.getId()));
                dto.setReturnCount(returns.countByTenantRegulatorId(entity.getId()));
                dto.setSanctionCount(countSanctionsByRegulator(List.of(entity)).getOrDefault(entity.getId(), 0L));
                return dto;
            })
            .orElseThrow(() -> ApiException.notFound("Regulator not found"));
    }

    @Transactional
    public TenantRegulatorDto create(CreateRegulatorRequest req) {
        Long tenantId = tenantIdentity.currentTenantId();
        if (repo.existsByTenantIdAndNameIgnoreCase(tenantId, req.getName())) {
            throw new IllegalArgumentException("Regulator with this name already exists");
        }
        TenantRegulator entity = mapper.toEntity(req);
        entity.setTenantId(tenantId);
        return mapper.toDto(repo.save(entity));
    }

    @Transactional
    public TenantRegulatorDto update(Long id, UpdateRegulatorRequest req) {
        Long tenantId = tenantIdentity.currentTenantId();
        TenantRegulator entity = repo.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> ApiException.notFound("Regulator not found"));
        if (req.getName() != null && !req.getName().equalsIgnoreCase(entity.getName())
            && repo.existsByTenantIdAndNameIgnoreCase(tenantId, req.getName())) {
            throw new IllegalArgumentException("Regulator with this name already exists");
        }
        mapper.updateEntity(entity, req);
        return mapper.toDto(repo.save(entity));
    }

    @Transactional
    public void disable(Long id) {
        Long tenantId = tenantIdentity.currentTenantId();
        TenantRegulator entity = repo.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> ApiException.notFound("Regulator not found"));
        entity.setIsActive(false);
        repo.save(entity);
    }

    @Transactional
    public void bulkDisable(List<Long> ids) {
        ids.forEach(this::disable);
    }
}
