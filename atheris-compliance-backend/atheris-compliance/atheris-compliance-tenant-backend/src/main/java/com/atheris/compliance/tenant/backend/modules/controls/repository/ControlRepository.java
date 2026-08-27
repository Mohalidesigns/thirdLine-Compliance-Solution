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
    boolean existsByControlNumber(String controlNumber);
    List<Control> findByControlOwnerUserId(Integer userId);
    List<Control> findByControlOwnerId(Integer ownerId);
    List<Control> findByTheme(String theme);
    List<Control> findByStatus(String status);
    List<Control> findByResidualRisk(String risk);
    List<Control> findByControlOwnerUserIdAndStatus(Integer userId, String status);
    List<Control> findByActId(Integer actId);
    List<Control> findByObligationId(Long obligationId);

    long countByStatus(String status);
    long countByResidualRisk(String risk);

    @Query(value = "SELECT DISTINCT ct.control_id FROM control_tasks ct WHERE ct.status = 'Pending' AND ct.due_date <= :today", nativeQuery = true)
    List<Integer> findControlIdsWithOverdueTasks(@Param("today") java.time.LocalDate today);

    @Query(value = "SELECT theme FROM controls WHERE theme IS NOT NULL AND theme != '' GROUP BY theme ORDER BY theme", nativeQuery = true)
    List<String> findDistinctThemes();

    @Query(value = "SELECT DISTINCT control_owner_name FROM controls WHERE control_owner_name IS NOT NULL AND control_owner_name != '' ORDER BY control_owner_name", nativeQuery = true)
    List<String> findDistinctOwners();

    @Query(value = "SELECT DISTINCT act_name FROM controls WHERE act_name IS NOT NULL AND act_name != '' ORDER BY act_name", nativeQuery = true)
    List<String> findDistinctActNames();
}
