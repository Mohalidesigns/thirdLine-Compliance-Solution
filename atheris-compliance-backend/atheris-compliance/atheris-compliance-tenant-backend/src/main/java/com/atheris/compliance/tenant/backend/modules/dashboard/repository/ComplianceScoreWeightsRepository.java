package com.atheris.compliance.tenant.backend.modules.dashboard.repository;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.ComplianceScoreWeights;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ComplianceScoreWeightsRepository extends JpaRepository<ComplianceScoreWeights, Long> {
    Optional<ComplianceScoreWeights> findFirstByOrderByWeightIdAsc();
}