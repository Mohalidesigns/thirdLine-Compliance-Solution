package com.atheris.tenant.modules.onboarding.repository;

import com.atheris.tenant.modules.onboarding.entity.RegulatorRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatorRecommendationRepository extends JpaRepository<RegulatorRecommendation, Integer> {
    List<RegulatorRecommendation> findByLicenceTypeOrderBySortOrderAsc(String licenceType);
}
