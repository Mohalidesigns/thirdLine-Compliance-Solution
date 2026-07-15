package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.Control;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControlRepository extends JpaRepository<Control, Integer> {
    Optional<Control> findByControlNumber(String controlNumber);
    boolean existsByControlNumber(String controlNumber);
    List<Control> findByControlOwnerUserId(Integer userId);
    List<Control> findByTheme(String theme);
    List<Control> findByStatus(String status);

    @Query(value = "SELECT * FROM controls WHERE residual_risk = 'High'", nativeQuery = true)
    List<Control> findHighResidualRisk();

    @Query(value = "SELECT * FROM controls WHERE control_owner_user_id = :userId AND status = 'Active'", nativeQuery = true)
    List<Control> findActiveByOwner(Integer userId);
}
