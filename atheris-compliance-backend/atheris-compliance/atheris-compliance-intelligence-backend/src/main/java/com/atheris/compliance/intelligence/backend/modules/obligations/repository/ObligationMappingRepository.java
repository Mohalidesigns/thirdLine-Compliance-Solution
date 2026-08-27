package com.atheris.compliance.intelligence.backend.modules.obligations.repository;

import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface ObligationMappingRepository extends JpaRepository<ObligationMapping, Long>, JpaSpecificationExecutor<ObligationMapping> {
    List<ObligationMapping> findByInstrumentId(Long instrumentId);
    List<ObligationMapping> findByInstrumentIdIn(Collection<Long> instrumentIds);
    List<ObligationMapping> findByRegulationId(Long regulationId);
    void deleteByInstrumentId(Long instrumentId);
    long countByRegulationId(Long regulationId);
    boolean existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(Long regulationId, String plainEnglishStatement, String specificSectionReference);
}
