package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ObligationPointRepository extends JpaRepository<ObligationPoint, Long> {
    List<ObligationPoint> findByObligationIdAndPointTypeOrderBySortOrder(Long obligationId, String pointType);
    List<ObligationPoint> findByObligationIdOrderBySortOrder(Long obligationId);

    @Modifying
    @Query(value = "DELETE FROM obligation_points WHERE obligation_id = :obligationId", nativeQuery = true)
    void deleteByObligationId(@Param("obligationId") Long obligationId);
}
