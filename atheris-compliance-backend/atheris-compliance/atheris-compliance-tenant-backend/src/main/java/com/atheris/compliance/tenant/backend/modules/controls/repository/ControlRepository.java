package com.atheris.compliance.tenant.backend.modules.controls.repository;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControlRepository extends JpaRepository<Control, Integer>, JpaSpecificationExecutor<Control> {
    Optional<Control> findByControlNumber(String controlNumber);
    List<Control> findByControlNumberIn(java.util.Collection<String> controlNumbers);
    boolean existsByControlNumber(String controlNumber);
    List<Control> findByControlOwnerId(Integer ownerId);
    List<Control> findByTesterOwnerId(Integer testerOwnerId);
    List<Control> findByControlThemeId(Integer controlThemeId);
    List<Control> findByStatus(String status);
    List<Control> findByControlOwnerDepartmentId(Integer departmentId);
    List<Control> findByControlOwnerTeamId(Integer teamId);

    long countByStatus(String status);
    long countByControlThemeId(Integer controlThemeId);

    @Query(value = "SELECT DISTINCT ct.control_id FROM control_tasks ct WHERE ct.status = 'Pending' AND ct.due_date <= :today", nativeQuery = true)
    List<Integer> findControlIdsWithOverdueTasks(@Param("today") java.time.LocalDate today);

    @Query(value = "SELECT DISTINCT control_owner_name FROM controls WHERE control_owner_name IS NOT NULL AND control_owner_name != '' ORDER BY control_owner_name", nativeQuery = true)
    List<String> findDistinctOwners();
}
