package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RiskObligation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RiskObligationRepository extends JpaRepository<RiskObligation, RiskObligation.Key> {
    List<RiskObligation> findByObligationId(Long obligationId);
}