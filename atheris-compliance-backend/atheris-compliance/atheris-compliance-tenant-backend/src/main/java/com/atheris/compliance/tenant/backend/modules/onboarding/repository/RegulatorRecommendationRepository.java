package com.atheris.compliance.tenant.backend.modules.onboarding.repository;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.RegulatorRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatorRecommendationRepository extends JpaRepository<RegulatorRecommendation, Integer>, JpaSpecificationExecutor<RegulatorRecommendation> {
    List<RegulatorRecommendation> findByLicenceTypeOrderBySortOrderAsc(String licenceType);
}
