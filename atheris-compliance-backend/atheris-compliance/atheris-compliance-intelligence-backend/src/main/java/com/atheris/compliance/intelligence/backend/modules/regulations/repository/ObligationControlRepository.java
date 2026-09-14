package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ObligationControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ObligationControlId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ObligationControlRepository extends JpaRepository<ObligationControl, ObligationControlId> {

    List<ObligationControl> findByObligationId(Long obligationId);

    List<ObligationControl> findByComplianceControlId(Long complianceControlId);

    boolean existsByObligationIdAndComplianceControlId(Long obligationId, Long complianceControlId);
}
