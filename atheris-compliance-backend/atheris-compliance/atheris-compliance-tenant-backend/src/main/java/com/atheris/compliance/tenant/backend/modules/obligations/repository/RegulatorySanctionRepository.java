package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatorySanctionRepository extends JpaRepository<RegulatorySanction, Long> {
    List<RegulatorySanction> findByInstrumentId(Long instrumentId);
    long countByInstrumentId(Long instrumentId);
    void deleteByInstrumentId(Long instrumentId);
}