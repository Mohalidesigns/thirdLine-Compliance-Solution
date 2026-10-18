package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Integer> {
    List<Department> findByIsActiveTrueOrderByNameAsc();
    boolean existsByName(String name);
    Optional<Department> findByName(String name);
}
