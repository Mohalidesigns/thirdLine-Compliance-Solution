package com.atheris.platform.modules.regulators.repository;

import com.atheris.platform.modules.regulators.entity.ScraperRunLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScraperRunLogRepository extends JpaRepository<ScraperRunLog, Long> {
    List<ScraperRunLog> findTop30ByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
    List<ScraperRunLog> findTop3ByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
    Optional<ScraperRunLog> findTopByRegulatorIdOrderByRunAtDesc(Integer regulatorId);
    @Query("SELECT AVG(s.documentsFound) FROM ScraperRunLog s WHERE s.regulatorId=:id ORDER BY s.runAt DESC")
    Double averageDocumentsFound(@Param("id") Integer id);
}
