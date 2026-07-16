package com.atheris.compliance.tenant.backend.modules.auth.repository;

import com.atheris.compliance.tenant.backend.modules.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer>, JpaSpecificationExecutor<RefreshToken> {
    Optional<RefreshToken> findByTokenHash(String hash);
    List<RefreshToken> findByUserIdAndIsRevokedFalse(Integer userId);
}
