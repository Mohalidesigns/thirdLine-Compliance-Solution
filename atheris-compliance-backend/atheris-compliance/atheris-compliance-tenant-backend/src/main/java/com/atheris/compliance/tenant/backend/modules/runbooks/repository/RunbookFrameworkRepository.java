package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookFramework;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RunbookFrameworkRepository extends JpaRepository<RunbookFramework, Integer> {
    Optional<RunbookFramework> findByCode(String code);
    List<RunbookFramework> findAllByOrderByIsInternalAscCodeAsc();
}
