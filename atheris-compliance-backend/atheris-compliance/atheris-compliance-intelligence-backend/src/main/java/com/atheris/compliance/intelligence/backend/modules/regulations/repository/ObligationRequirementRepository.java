package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ObligationRequirement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ObligationRequirementRepository extends JpaRepository<ObligationRequirement, Long> {
    List<ObligationRequirement> findByObligationIdOrderByOrdinalAsc(Long obligationId);
    List<ObligationRequirement> findByObligationIdInOrderByObligationIdAscOrdinalAsc(java.util.Collection<Long> obligationIds);
    void deleteByObligationId(Long obligationId);
}