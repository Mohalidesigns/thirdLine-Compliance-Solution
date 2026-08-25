package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatoryReturnRepository extends JpaRepository<RegulatoryReturn, Long>, JpaSpecificationExecutor<RegulatoryReturn> {
    List<RegulatoryReturn> findByStatus(RegulatoryReturnStatus status);
    List<RegulatoryReturn> findByFilingRegulator(String regulator);
    List<RegulatoryReturn> findByTenantRegulatorId(Long tenantRegulatorId);
    List<RegulatoryReturn> findByActId(Long actId);
    long countByActId(Long actId);
    boolean existsByReturnNameAndActId(String returnName, Long actId);
    boolean existsByReturnNameAndTenantRegulatorId(String returnName, Long tenantRegulatorId);
}