package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TeamRepository extends JpaRepository<Team, Integer> {
    List<Team> findByDepartmentIdOrderByNameAsc(Integer departmentId);

    @Query(value = "SELECT department_id AS departmentId, COUNT(*) AS rowCount "
        + "FROM teams GROUP BY department_id", nativeQuery = true)
    List<DepartmentTeamCountRow> countGroupedByDepartment();

    interface DepartmentTeamCountRow {
        Integer getDepartmentId();
        long getRowCount();
    }
}
