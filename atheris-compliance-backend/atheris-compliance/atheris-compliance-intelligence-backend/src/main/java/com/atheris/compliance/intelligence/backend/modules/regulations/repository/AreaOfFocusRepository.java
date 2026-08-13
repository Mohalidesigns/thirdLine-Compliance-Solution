package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.AreaOfFocus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AreaOfFocusRepository extends JpaRepository<AreaOfFocus, Long> {
    Optional<AreaOfFocus> findByName(String name);
}