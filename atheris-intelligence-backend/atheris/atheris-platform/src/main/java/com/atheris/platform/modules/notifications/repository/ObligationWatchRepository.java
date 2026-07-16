package com.atheris.platform.modules.notifications.repository;

import com.atheris.platform.modules.notifications.entity.ObligationWatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ObligationWatchRepository extends JpaRepository<ObligationWatch, Long> {
    List<ObligationWatch> findByInstrumentIdAndIsWatchingTrue(Long instrumentId);
    Optional<ObligationWatch> findByInstrumentIdAndTenantId(Long instrumentId, Long tenantId);
    List<ObligationWatch> findByTenantIdAndIsWatchingTrue(Long tenantId);
    boolean existsByInstrumentIdAndTenantId(Long instrumentId, Long tenantId);
}
