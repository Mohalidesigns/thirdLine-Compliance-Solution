package com.atheris.compliance.tenant.backend.modules.controls.repository;

import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTheme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ControlThemeRepository extends JpaRepository<ControlTheme, Integer> {
    List<ControlTheme> findAllByOrderByNameAsc();
    List<ControlTheme> findByIsActiveTrueOrderByNameAsc();
    Optional<ControlTheme> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
