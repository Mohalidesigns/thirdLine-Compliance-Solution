package com.atheris.compliance.tenant.backend.modules.remediation.repository;

import com.atheris.compliance.tenant.backend.modules.remediation.entity.RemediationLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RemediationLinkRepository extends JpaRepository<RemediationLink, Long> {
    Optional<RemediationLink> findByTokenHash(String tokenHash);
    List<RemediationLink> findByFindingId(Long findingId);
}