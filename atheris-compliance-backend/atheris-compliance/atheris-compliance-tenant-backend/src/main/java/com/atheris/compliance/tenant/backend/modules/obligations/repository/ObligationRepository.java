package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ObligationRepository extends JpaRepository<Obligation, Long> {
    List<Obligation> findByInstrumentId(Long instrumentId);
    long countByInstrumentId(Long instrumentId);
}
