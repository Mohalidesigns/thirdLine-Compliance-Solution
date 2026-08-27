package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;

public interface ObligationRepository extends JpaRepository<Obligation, Long> {
    boolean existsByObligationNumber(Integer obligationNumber);
    List<Obligation> findByInstrumentId(Long instrumentId);
    long countByInstrumentId(Long instrumentId);

    @Query(value = "SELECT instrument_id, COUNT(*) AS cnt FROM obligations WHERE instrument_id IN (:ids) GROUP BY instrument_id", nativeQuery = true)
    java.util.List<Object[]> countByInstrumentIdIn(@Param("ids") Collection<Long> ids);

    @Query("SELECT DISTINCT o.instrumentId FROM Obligation o")
    List<Long> findDistinctInstrumentIds();

    @Modifying
    @Query(value = "DELETE FROM obligations WHERE instrument_id = :instrumentId", nativeQuery = true)
    void deleteByInstrumentId(@Param("instrumentId") Long instrumentId);

    @Query(value = "SELECT obligation_id AS obligationId, return_id AS returnId FROM obligation_returns", nativeQuery = true)
    List<ObligationReturnRow> findAllReturnLinks();

    @Query(value = "SELECT return_id FROM obligation_returns WHERE obligation_id = :obligationId", nativeQuery = true)
    List<Long> findLinkedReturnIds(@Param("obligationId") Long obligationId);

    @Query(value = "SELECT obligation_id FROM obligation_returns WHERE return_id = :returnId", nativeQuery = true)
    List<Long> findLinkedObligationIds(@Param("returnId") Long returnId);

    @Modifying
    @Query(value = "DELETE FROM obligation_returns WHERE obligation_id = :obligationId", nativeQuery = true)
    void deleteReturnLinks(@Param("obligationId") Long obligationId);

    @Modifying
    @Query(value = "DELETE FROM obligation_returns WHERE return_id = :returnId", nativeQuery = true)
    void deleteObligationLinks(@Param("returnId") Long returnId);

    @Modifying
    @Query(value = "INSERT INTO obligation_returns (obligation_id, return_id) VALUES (:obligationId, :returnId)", nativeQuery = true)
    void insertReturnLink(@Param("obligationId") Long obligationId, @Param("returnId") Long returnId);

    interface ObligationReturnRow {
        Long getObligationId();
        Long getReturnId();
    }
}
