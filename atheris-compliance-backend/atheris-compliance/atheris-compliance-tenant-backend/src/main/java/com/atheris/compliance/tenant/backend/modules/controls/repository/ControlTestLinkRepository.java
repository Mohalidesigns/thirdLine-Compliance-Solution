package com.atheris.compliance.tenant.backend.modules.controls.repository;

import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ControlTestLinkRepository extends JpaRepository<ControlTestLink, Long> {

    Optional<ControlTestLink> findByTokenHash(String tokenHash);

    List<ControlTestLink> findByControlId(Integer controlId);

    boolean existsByControlId(Integer controlId);
}
