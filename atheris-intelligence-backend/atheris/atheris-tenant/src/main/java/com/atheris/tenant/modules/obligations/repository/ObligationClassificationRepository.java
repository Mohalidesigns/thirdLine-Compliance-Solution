package com.atheris.tenant.modules.obligations.repository;

import com.atheris.tenant.modules.obligations.entity.ObligationClassification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ObligationClassificationRepository extends JpaRepository<ObligationClassification, Long>, JpaSpecificationExecutor<ObligationClassification> {
    Optional<ObligationClassification> findByInstrumentId(Long instrumentId);
    Page<ObligationClassification> findByApplicability(String applicability, Pageable p);
    Page<ObligationClassification> findByStatus(String status, Pageable p);
    List<ObligationClassification> findByHasGapTrue();
    long countByApplicability(String applicability);
    long countByHasGapTrue();
    List<ObligationClassification> findByApplicabilityAndCcoApprovedFalseAndTenantRiskRating(String applicability, String riskRating);
}
