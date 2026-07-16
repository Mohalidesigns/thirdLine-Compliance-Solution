package com.atheris.compliance.intelligence.backend.modules.notifications.repository;

import com.atheris.compliance.intelligence.backend.modules.notifications.entity.ObligationWatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ObligationWatchRepository extends JpaRepository<ObligationWatch, Long>, JpaSpecificationExecutor<ObligationWatch> {
    List<ObligationWatch> findByInstrumentIdAndIsWatchingTrue(Long instrumentId);
    Optional<ObligationWatch> findByInstrumentIdAndTenantId(Long instrumentId, Long tenantId);
    List<ObligationWatch> findByTenantIdAndIsWatchingTrue(Long tenantId);
    boolean existsByInstrumentIdAndTenantId(Long instrumentId, Long tenantId);
}
