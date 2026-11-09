package com.atheris.compliance.tenant.backend.modules.requirements.repository;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface RequirementControlRepository extends JpaRepository<RequirementControl, RequirementControl.Key> {
    List<RequirementControl> findByRequirementId(Long requirementId);
    List<RequirementControl> findByRequirementIdIn(Collection<Long> requirementIds);
    List<RequirementControl> findByControlId(Integer controlId);
    List<RequirementControl> findByControlIdIn(Collection<Integer> controlIds);
    void deleteByRequirementId(Long requirementId);
}
