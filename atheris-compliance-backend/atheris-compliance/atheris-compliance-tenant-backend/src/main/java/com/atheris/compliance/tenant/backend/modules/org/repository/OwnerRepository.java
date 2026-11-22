package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface OwnerRepository extends JpaRepository<Owner, Integer> {
    List<Owner> findByIsActiveTrueOrderByFullNameAsc();
    List<Owner> findByTeamIdOrderByFullNameAsc(Integer teamId);
    List<Owner> findByDepartmentIdOrderByFullNameAsc(Integer departmentId);
    Optional<Owner> findFirstByEmailIgnoreCase(String email);

    @Query(value = "SELECT department_id AS departmentId, COUNT(*) AS rowCount "
        + "FROM stakeholders WHERE department_id IS NOT NULL GROUP BY department_id", nativeQuery = true)
    List<DepartmentOwnerCountRow> countGroupedByDepartment();

    @Query(value = "SELECT team_id AS teamId, COUNT(*) AS rowCount "
        + "FROM stakeholders WHERE team_id IS NOT NULL GROUP BY team_id", nativeQuery = true)
    List<TeamOwnerCountRow> countGroupedByTeam();

    interface DepartmentOwnerCountRow {
        Integer getDepartmentId();
        long getRowCount();
    }

    interface TeamOwnerCountRow {
        Integer getTeamId();
        long getRowCount();
    }
}
