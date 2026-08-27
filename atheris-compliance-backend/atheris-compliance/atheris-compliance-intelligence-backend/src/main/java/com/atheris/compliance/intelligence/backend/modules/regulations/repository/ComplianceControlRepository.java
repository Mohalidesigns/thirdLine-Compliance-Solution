package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplianceControlRepository extends JpaRepository<ComplianceControl, Long> {
    Optional<ComplianceControl> findByControlNumber(String controlNumber);
    boolean existsByControlNumber(String controlNumber);
    List<ComplianceControl> findByActId(Long actId);
    List<ComplianceControl> findByTheme(String theme);

    @Query(value = "SELECT cc.* FROM compliance_controls cc " +
           "JOIN acts a ON cc.act_id = a.act_id " +
           "WHERE a.regulator_id IN :regulatorIds", nativeQuery = true)
    List<ComplianceControl> findByRegulatorIds(@Param("regulatorIds") List<Integer> regulatorIds);
}
