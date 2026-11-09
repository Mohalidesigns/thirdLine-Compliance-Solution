package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RiskControl;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskControlRepository extends JpaRepository<RiskControl, RiskControl.Key> {
}