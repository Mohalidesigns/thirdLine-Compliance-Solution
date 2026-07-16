package com.atheris.compliance.intelligence.backend.modules.regulators.repository;

import com.atheris.compliance.intelligence.backend.modules.regulators.entity.ScraperRunLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScraperRunLogRepository extends JpaRepository<ScraperRunLog, Long>, JpaSpecificationExecutor<ScraperRunLog> {
    List<ScraperRunLog> findTop30ByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
    List<ScraperRunLog> findTop3ByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
    Optional<ScraperRunLog> findTopByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
}
