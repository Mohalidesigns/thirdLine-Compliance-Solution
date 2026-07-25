package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RiskType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RiskTypeRepository extends JpaRepository<RiskType, Integer> {
    List<RiskType> findAllByOrderByDisplayOrderAsc();
}
