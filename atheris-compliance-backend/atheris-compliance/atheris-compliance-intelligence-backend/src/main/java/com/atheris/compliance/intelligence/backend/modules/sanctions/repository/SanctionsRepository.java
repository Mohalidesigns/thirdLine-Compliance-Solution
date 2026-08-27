package com.atheris.compliance.intelligence.backend.modules.sanctions.repository;

import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface SanctionsRepository extends JpaRepository<SanctionsPenalty, Long>, JpaSpecificationExecutor<SanctionsPenalty> {
    List<SanctionsPenalty> findByInstrumentId(Long instrumentId);
    List<SanctionsPenalty> findByInstrumentIdIn(Collection<Long> instrumentIds);
    List<SanctionsPenalty> findByRegulationId(Long regulationId);
    long countByRegulationId(Long regulationId);
    boolean existsByRegulationIdAndDescription(Long regulationId, String description);
    boolean existsByRegulationIdAndSourceSectionReferenceAndDescription(Long regulationId, String sourceSectionReference, String description);
    boolean existsByRegulationIdAndSourceSectionReferenceAndDescriptionAndPenaltyDetails(Long regulationId, String sourceSectionReference, String description, String penaltyDetails);
}
