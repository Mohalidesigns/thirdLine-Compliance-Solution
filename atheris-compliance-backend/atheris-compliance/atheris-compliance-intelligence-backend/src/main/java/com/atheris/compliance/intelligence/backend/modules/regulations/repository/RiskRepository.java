package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Risk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RiskRepository extends JpaRepository<Risk, Integer> {
    Optional<Risk> findByCode(String code);
}