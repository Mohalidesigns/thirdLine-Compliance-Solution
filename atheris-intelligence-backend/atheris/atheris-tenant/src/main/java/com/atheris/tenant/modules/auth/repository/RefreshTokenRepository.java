package com.atheris.tenant.modules.auth.repository;

import com.atheris.tenant.modules.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {
    Optional<RefreshToken> findByTokenHash(String hash);
    List<RefreshToken> findByUserIdAndIsRevokedFalse(Integer userId);
}
