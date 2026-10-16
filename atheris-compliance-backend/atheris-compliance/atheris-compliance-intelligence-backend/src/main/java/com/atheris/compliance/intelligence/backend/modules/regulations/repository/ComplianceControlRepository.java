package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ComplianceControlRepository extends JpaRepository<ComplianceControl, Long>, JpaSpecificationExecutor<ComplianceControl> {
    Optional<ComplianceControl> findByControlNumber(String controlNumber);
    boolean existsByControlNumber(String controlNumber);
    List<ComplianceControl> findByActId(Long actId);
    List<ComplianceControl> findByTheme(String theme);
    List<ComplianceControl> findByObligationId(Long obligationId);
    List<ComplianceControl> findByObligationIdIn(Collection<Long> obligationIds);

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

    /**
     * Batched variant of {@link #findByLinkedObligationId}: one query for many obligations, so a
     * register page can count linked controls without an N+1. Rows may match more than one id.
     */
    default List<ComplianceControl> findByLinkedObligationIdIn(Collection<Long> obligationIds) {
        if (obligationIds == null || obligationIds.isEmpty()) return List.of();
        return findAll((root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> clauses = new java.util.ArrayList<>();
            clauses.add(cb.isNotNull(root.get("linkedObligationIds")));
            List<jakarta.persistence.criteria.Predicate> matches = new java.util.ArrayList<>();
            for (Long id : obligationIds) {
                if (id == null) continue;
                String needle = "%," + id + ",%";
                matches.add(cb.like(cb.concat(cb.concat(",", root.<String>get("linkedObligationIds")), ","), needle));
            }
            clauses.add(cb.or(matches.toArray(new jakarta.persistence.criteria.Predicate[0])));
            return cb.and(clauses.toArray(new jakarta.persistence.criteria.Predicate[0]));
        });
    }

    @Query(value = "SELECT cc.* FROM compliance_controls cc " +
           "JOIN acts a ON cc.act_id = a.act_id " +
           "WHERE a.regulator_id IN :regulatorIds", nativeQuery = true)
    List<ComplianceControl> findByRegulatorIds(@Param("regulatorIds") List<Integer> regulatorIds);
}
