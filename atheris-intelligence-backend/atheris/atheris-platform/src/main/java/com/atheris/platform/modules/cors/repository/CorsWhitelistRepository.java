package com.atheris.platform.modules.cors.repository;

import com.atheris.platform.modules.cors.entity.CorsWhitelist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CorsWhitelistRepository extends JpaRepository<CorsWhitelist, Long>, JpaSpecificationExecutor<CorsWhitelist> {
    List<CorsWhitelist> findByIsActiveTrue();
    boolean existsByOrigin(String origin);
}
