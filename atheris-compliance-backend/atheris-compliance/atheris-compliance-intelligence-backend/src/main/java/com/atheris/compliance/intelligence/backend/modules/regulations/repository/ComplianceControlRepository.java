package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplianceControlRepository extends JpaRepository<ComplianceControl, Long>, JpaSpecificationExecutor<ComplianceControl> {
    Optional<ComplianceControl> findByControlNumber(String controlNumber);
    boolean existsByControlNumber(String controlNumber);
    List<ComplianceControl> findByActId(Long actId);
    List<ComplianceControl> findByTheme(String theme);
    List<ComplianceControl> findByObligationId(Long obligationId);

    /**
     * Controls whose comma-separated {@code linked_obligation_ids} list contains {@code obligationId}.
     * The column is wrapped in commas so both single and multi-value rows match exactly
     * ({@code ,<id>,} never matches a partial id such as 10 vs 102).
     */
    default List<ComplianceControl> findByLinkedObligationId(Long obligationId) {
        if (obligationId == null) return List.of();
        String needle = "%," + obligationId + ",%";
        return findAll((root, query, cb) -> cb.and(
            cb.isNotNull(root.get("linkedObligationIds")),
            cb.like(cb.concat(cb.concat(",", root.<String>get("linkedObligationIds")), ","), needle)));
    }

    @Query(value = "SELECT cc.* FROM compliance_controls cc " +
           "JOIN acts a ON cc.act_id = a.act_id " +
           "WHERE a.regulator_id IN :regulatorIds", nativeQuery = true)
    List<ComplianceControl> findByRegulatorIds(@Param("regulatorIds") List<Integer> regulatorIds);
}
