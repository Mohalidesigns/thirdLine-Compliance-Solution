package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.ControlTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ControlTaskRepository extends JpaRepository<ControlTask, Long> {
    List<ControlTask> findByAssignedToUserId(Integer userId);
    List<ControlTask> findByStatus(String status);
    List<ControlTask> findByControlId(Integer controlId);

    @Query(value = "SELECT * FROM control_tasks WHERE status = 'Pending' AND due_date < :today", nativeQuery = true)
    List<ControlTask> findOverdue(LocalDate today);

    @Query(value = "SELECT * FROM control_tasks WHERE assigned_to_user_id = :uid AND status IN ('Pending','In Progress','Overdue')", nativeQuery = true)
    List<ControlTask> findActiveForUser(Integer uid);

    @Modifying
    @Query(value = "UPDATE control_tasks SET status = 'Overdue' WHERE status = 'Pending' AND due_date < :today", nativeQuery = true)
    int markOverdue(LocalDate today);
}
