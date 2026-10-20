package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnUploadLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReturnUploadLinkRepository extends JpaRepository<ReturnUploadLink, Long> {
    Optional<ReturnUploadLink> findByTokenHash(String tokenHash);
}
