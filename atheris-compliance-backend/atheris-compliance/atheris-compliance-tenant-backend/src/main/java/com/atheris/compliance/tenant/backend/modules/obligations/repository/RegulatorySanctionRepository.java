package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

@Repository
public interface RegulatorySanctionRepository extends JpaRepository<RegulatorySanction, Long> {
    List<RegulatorySanction> findByInstrumentId(Long instrumentId);
    List<RegulatorySanction> findByInstrumentIdIn(Collection<Long> instrumentIds);
    long countByInstrumentId(Long instrumentId);
    void deleteByInstrumentId(Long instrumentId);

    @Query(value = "SELECT COALESCE(SUM(sanction_amount_naira), 0) FROM regulatory_sanctions", nativeQuery = true)
    BigDecimal sumExposure();
}