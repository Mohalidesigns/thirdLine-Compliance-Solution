package com.atheris.platform.modules.regulators.repository;

import com.atheris.platform.modules.regulators.entity.Regulator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegulatorRepository extends JpaRepository<Regulator, Integer> {
    List<Regulator> findByIsActiveTrue();
    List<Regulator> findByIsActiveTrueAndScraperEnabledTrue();
    Optional<Regulator> findByAbbreviation(String abbreviation);
    boolean existsByAbbreviation(String abbreviation);
    @Modifying
    @Transactional
    @Query("UPDATE Regulator r SET r.scraperLastRanAt=:ranAt, r.scraperLastFound=:found, r.updatedAt=:ranAt WHERE r.regulatorId=:id")
    void updateLastRan(@Param("id") Integer id, @Param("ranAt") Instant ranAt, @Param("found") Integer found);
}
