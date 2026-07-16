package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.Control;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControlRepository extends JpaRepository<Control, Integer>, JpaSpecificationExecutor<Control> {
    Optional<Control> findByControlNumber(String controlNumber);
    boolean existsByControlNumber(String controlNumber);
    List<Control> findByControlOwnerUserId(Integer userId);
    List<Control> findByTheme(String theme);
    List<Control> findByStatus(String status);
    List<Control> findByResidualRisk(String risk);
    List<Control> findByControlOwnerUserIdAndStatus(Integer userId, String status);
}
