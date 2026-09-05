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
    void deleteByInstrumentId(Long instrumentId);
    long countByRegulationId(Long regulationId);
    boolean existsByRegulationIdAndPlainEnglishStatementAndSpecificSectionReference(Long regulationId, String plainEnglishStatement, String specificSectionReference);
    boolean existsByInstrumentIdAndPlainEnglishStatement(Long instrumentId, String plainEnglishStatement);
    boolean existsByInstrumentIdAndPlainEnglishStatementAndSpecificSectionReference(Long instrumentId, String plainEnglishStatement, String specificSectionReference);

    @Query("select o.inherentRiskRating, count(o) from ObligationMapping o group by o.inherentRiskRating")
    List<Object[]> groupByInherentRiskRating();

    @Query("select o.areaOfFocus, count(o) from ObligationMapping o group by o.areaOfFocus")
    List<Object[]> groupByAreaOfFocus();

    @Query("select o.obligationType, count(o) from ObligationMapping o group by o.obligationType")
    List<Object[]> groupByObligationType();
}
