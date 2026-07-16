package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatoryReturnRepository extends JpaRepository<RegulatoryReturn, Long>, JpaSpecificationExecutor<RegulatoryReturn> {
    List<RegulatoryReturn> findByStatus(String status);
    List<RegulatoryReturn> findByFilingRegulator(String regulator);
}
