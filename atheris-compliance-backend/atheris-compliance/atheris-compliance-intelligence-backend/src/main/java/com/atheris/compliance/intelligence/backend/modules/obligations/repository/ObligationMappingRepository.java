package com.atheris.compliance.intelligence.backend.modules.obligations.repository;

import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface ObligationMappingRepository extends JpaRepository<ObligationMapping, Long>, JpaSpecificationExecutor<ObligationMapping> {
    List<ObligationMapping> findByInstrumentId(Long instrumentId);
    List<ObligationMapping> findByInstrumentIdIn(Collection<Long> instrumentIds);
    List<ObligationMapping> findByRegulationId(Long regulationId);
    List<ObligationMapping> findByPointsIsNull();
    @Query(value = "SELECT * FROM obligation_mappings WHERE points IS NULL OR jsonb_array_length(points) = 0", nativeQuery = true)
    List<ObligationMapping> findByPointsEmpty();
    void deleteByInstrumentId(Long instrumentId);
    long countByRegulationId(Long regulationId);
    boolean existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(Long regulationId, String plainEnglishStatement, String specificSectionReference);
    boolean existsByInstrumentIdAndPlainEnglishStatement(Long instrumentId, String plainEnglishStatement);
    boolean existsByInstrumentIdAndPlainEnglishStatementAndSpecificSectionReference(Long instrumentId, String plainEnglishStatement, String specificSectionReference);
}
