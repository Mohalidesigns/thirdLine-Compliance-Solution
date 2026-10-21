package com.atheris.compliance.tenant.backend.modules.escalation.repository;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationInstanceLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EscalationInstanceLevelRepository extends JpaRepository<EscalationInstanceLevel, Long> {
    List<EscalationInstanceLevel> findByOverrideIdOrderByLevelNoAsc(Long overrideId);
    void deleteByOverrideId(Long overrideId);
}
