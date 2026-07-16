package com.atheris.compliance.tenant.backend.modules.onboarding.service;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.RegulatorRecommendation;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.RegulatorRecommendationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RegulatorRecommendationService {

    private final RegulatorRecommendationRepository repository;

    public List<RegulatorRecommendation> findAll() {
        return repository.findAll();
    }

    public List<RegulatorRecommendation> findByLicenceType(String licenceType) {
        return repository.findByLicenceTypeOrderBySortOrderAsc(licenceType);
    }

    public List<Integer> getRecommendedRegulatorIds(String licenceType) {
        return repository.findByLicenceTypeOrderBySortOrderAsc(licenceType)
            .stream().map(RegulatorRecommendation::getRegulatorId).toList();
    }

    @Transactional
    public RegulatorRecommendation create(RegulatorRecommendation rec) {
        return repository.save(rec);
    }

    @Transactional
    public RegulatorRecommendation update(Integer id, RegulatorRecommendation updated) {
        RegulatorRecommendation existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Recommendation not found: " + id));
        existing.setLicenceType(updated.getLicenceType());
        existing.setRegulatorId(updated.getRegulatorId());
        existing.setSortOrder(updated.getSortOrder());
        return repository.save(existing);
    }

    @Transactional
    public void delete(Integer id) {
        repository.deleteById(id);
    }
}
