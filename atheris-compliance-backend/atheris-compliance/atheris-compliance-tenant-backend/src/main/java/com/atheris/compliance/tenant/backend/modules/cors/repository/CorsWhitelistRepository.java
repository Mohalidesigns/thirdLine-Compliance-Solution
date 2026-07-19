package com.atheris.compliance.tenant.backend.modules.cors.repository;

import com.atheris.compliance.tenant.backend.modules.cors.entity.CorsWhitelist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CorsWhitelistRepository extends JpaRepository<CorsWhitelist, Long> {
    List<CorsWhitelist> findByIsActiveTrue();
    boolean existsByOrigin(String origin);
}
