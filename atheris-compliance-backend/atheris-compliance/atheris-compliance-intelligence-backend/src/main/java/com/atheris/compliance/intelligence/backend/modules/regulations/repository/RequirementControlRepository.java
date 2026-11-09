package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RequirementControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequirementControlRepository extends JpaRepository<RequirementControl, RequirementControl.Key> {
    List<RequirementControl> findByControlId(Integer controlId);
    List<RequirementControl> findByRequirementIdIn(java.util.Collection<Long> requirementIds);
}