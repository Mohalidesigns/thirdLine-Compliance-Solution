package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.ControlTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ControlTaskRepository extends JpaRepository<ControlTask, Long>, JpaSpecificationExecutor<ControlTask> {
    List<ControlTask> findByAssignedToUserId(Integer userId);
    List<ControlTask> findByStatus(String status);
    List<ControlTask> findByControlId(Integer controlId);
    List<ControlTask> findByStatusAndDueDateBefore(String status, LocalDate today);
    List<ControlTask> findByAssignedToUserIdAndStatusIn(Integer userId, List<String> statuses);
}
