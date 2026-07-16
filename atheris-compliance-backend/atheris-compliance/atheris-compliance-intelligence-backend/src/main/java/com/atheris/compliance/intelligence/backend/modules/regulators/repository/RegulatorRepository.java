package com.atheris.compliance.intelligence.backend.modules.regulators.repository;

import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegulatorRepository extends JpaRepository<Regulator, Integer>, JpaSpecificationExecutor<Regulator> {
    List<Regulator> findByIsActiveTrue();
    List<Regulator> findByIsActiveTrueAndScraperEnabledTrue();
    Optional<Regulator> findByAbbreviation(String abbreviation);
    boolean existsByAbbreviation(String abbreviation);
}
