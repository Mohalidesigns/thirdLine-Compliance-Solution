package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationSanction;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationSanctionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ObligationSanctionRepository extends JpaRepository<ObligationSanction, ObligationSanctionId> {

    @Query(value = "SELECT sanction_id FROM obligation_sanctions WHERE obligation_id = :obligationId", nativeQuery = true)
    List<Long> findLinkedSanctionIds(@Param("obligationId") Long obligationId);

    @Query(value = "SELECT obligation_id AS obligationId, sanction_id AS sanctionId FROM obligation_sanctions", nativeQuery = true)
    List<ObligationSanctionRow> findAllSanctionLinks();

    @Modifying
    @Query(value = "DELETE FROM obligation_sanctions WHERE obligation_id = :obligationId", nativeQuery = true)
    void deleteByObligationId(@Param("obligationId") Long obligationId);

    @Modifying
    @Query(value = "DELETE FROM obligation_sanctions WHERE sanction_id = :sanctionId", nativeQuery = true)
    void deleteBySanctionId(@Param("sanctionId") Long sanctionId);

    @Modifying
    @Query(value = "INSERT INTO obligation_sanctions (obligation_id, sanction_id) VALUES (:obligationId, :sanctionId) ON CONFLICT DO NOTHING", nativeQuery = true)
    void insertSanctionLink(@Param("obligationId") Long obligationId, @Param("sanctionId") Long sanctionId);

    interface ObligationSanctionRow {
        Long getObligationId();
        Long getSanctionId();
    }
}
