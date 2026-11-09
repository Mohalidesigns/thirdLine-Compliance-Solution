package com.atheris.compliance.tenant.backend.modules.requirements.repository;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RequirementRepository extends JpaRepository<Requirement, Long>, JpaSpecificationExecutor<Requirement> {
    List<Requirement> findByObligationIdOrderByOrdinalAsc(Long obligationId);
    List<Requirement> findByObligationIdInOrderByObligationIdAscOrdinalAsc(Collection<Long> obligationIds);
    List<Requirement> findByRiskId(Integer riskId);
    Optional<Requirement> findByObligationIdAndOrdinal(Long obligationId, Integer ordinal);
    long countByObligationId(Long obligationId);
    void deleteByObligationId(Long obligationId);
}
