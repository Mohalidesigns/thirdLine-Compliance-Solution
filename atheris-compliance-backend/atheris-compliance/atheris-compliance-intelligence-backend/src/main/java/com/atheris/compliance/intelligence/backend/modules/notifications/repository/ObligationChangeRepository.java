package com.atheris.compliance.intelligence.backend.modules.notifications.repository;

import com.atheris.compliance.intelligence.backend.modules.notifications.entity.ObligationChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ObligationChangeRepository extends JpaRepository<ObligationChange, Long>, JpaSpecificationExecutor<ObligationChange> {
    List<ObligationChange> findByInstrumentIdOrderByCreatedAtDesc(Long instrumentId);
}
