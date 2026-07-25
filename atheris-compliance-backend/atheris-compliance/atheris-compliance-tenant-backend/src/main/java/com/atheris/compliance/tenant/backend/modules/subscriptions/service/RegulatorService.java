package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.modules.onboarding.dto.RegulatorSummary;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.CreateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.TenantRegulatorDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UpdateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.mapper.TenantRegulatorMapper;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import jakarta.persistence.criteria.Predicate;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service @Slf4j @RequiredArgsConstructor
public class RegulatorService {

    private final TenantRegulatorRepository repo;
    private final TenantRegulatorMapper mapper;
    private final TenantProfileRepository profiles;
    private final PlatformApiClient platform;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public Page<TenantRegulatorDto> list(String search, Pageable pageable) {
        syncFromProfile();
        Specification<TenantRegulator> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), tenantId));
            if (search != null && !search.isBlank())
                predicates.add(cb.like(cb.lower(root.get("name")), "%" + search.toLowerCase() + "%"));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repo.findAll(spec, pageable).map(mapper::toDto);
    }

    @Transactional
    public void syncFromProfile() {
        profiles.findByTenantId(tenantId).ifPresent(p -> {
            List<Integer> subscribed = p.getSubscribedRegulators();
            if (subscribed == null || subscribed.isEmpty()) return;

            long existingCount = repo.countByTenantId(tenantId);
            if (existingCount >= subscribed.size()) return;

            List<TenantRegulator> existing = repo.findByTenantIdAndIsActiveTrue(tenantId);
            List<RegulatorSummary> allRegs = platform.fetchRegulators();

            for (Integer regId : subscribed) {
                boolean alreadyExists = existing.stream()
                    .anyMatch(e -> regId.equals(e.getPlatformRegulatorId()));
                if (alreadyExists) continue;

                String name = null, abbr = null;
                if (allRegs != null) {
                    RegulatorSummary s = allRegs.stream()
                        .filter(r -> regId.equals(r.getRegulatorId()))
                        .findFirst().orElse(null);
                    if (s != null) { name = s.getName(); abbr = s.getAbbreviation(); }
                }
                if (name == null) name = "Regulator " + regId;

                repo.save(TenantRegulator.builder()
                    .tenantId(tenantId).name(name).abbreviation(abbr)
                    .platformRegulatorId(regId).isActive(true).build());
                log.info("Auto-created TenantRegulator for platform regulator {}", regId);
            }
        });
    }

    public TenantRegulatorDto getById(Long id) {
        return repo.findByIdAndTenantId(id, tenantId)
            .map(mapper::toDto)
            .orElseThrow(() -> new RuntimeException("Regulator not found"));
    }

    @Transactional
    public TenantRegulatorDto create(CreateRegulatorRequest req) {
        if (repo.existsByTenantIdAndNameIgnoreCase(tenantId, req.getName()))
            throw new IllegalArgumentException("Regulator with this name already exists");
        TenantRegulator entity = mapper.toEntity(req);
        entity.setTenantId(tenantId);
        return mapper.toDto(repo.save(entity));
    }

    @Transactional
    public TenantRegulatorDto update(Long id, UpdateRegulatorRequest req) {
        TenantRegulator entity = repo.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new RuntimeException("Regulator not found"));
        if (req.getName() != null && !req.getName().equalsIgnoreCase(entity.getName())
            && repo.existsByTenantIdAndNameIgnoreCase(tenantId, req.getName()))
            throw new IllegalArgumentException("Regulator with this name already exists");
        mapper.updateEntity(entity, req);
        return mapper.toDto(repo.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        TenantRegulator entity = repo.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new RuntimeException("Regulator not found"));
        repo.delete(entity);
    }
}
