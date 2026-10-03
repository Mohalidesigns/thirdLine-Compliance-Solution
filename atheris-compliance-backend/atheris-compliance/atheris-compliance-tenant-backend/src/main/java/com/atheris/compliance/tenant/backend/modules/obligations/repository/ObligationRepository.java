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
    java.util.Optional<Obligation> findFirstByObligationNumberNotNullOrderByObligationNumberDesc();
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

    @Query(value = "SELECT o.obligation_id AS obligationId, o.title AS title, o.name AS name, "
        + "o.plain_english_statement AS plainEnglishStatement, o.section_reference AS sectionReference, "
        + "o.area_of_focus AS areaOfFocus, o.inherent_risk_rating AS inherentRiskRating, o.act_name AS actName, "
        + "o.obligation_type AS obligationType, o.recurring_deadline_type AS recurringDeadlineType "
        + "FROM obligation_returns orr JOIN obligations o ON o.obligation_id = orr.obligation_id "
        + "WHERE orr.return_id = :returnId ORDER BY o.obligation_id", nativeQuery = true)
    List<LinkedObligationRow> findLinkedObligationDetails(@Param("returnId") Long returnId);

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

    interface LinkedObligationRow {
        Long getObligationId();
        String getTitle();
        String getName();
        String getPlainEnglishStatement();
        String getSectionReference();
        String getAreaOfFocus();
        String getInherentRiskRating();
        String getActName();
        String getObligationType();
        String getRecurringDeadlineType();
    }
}
