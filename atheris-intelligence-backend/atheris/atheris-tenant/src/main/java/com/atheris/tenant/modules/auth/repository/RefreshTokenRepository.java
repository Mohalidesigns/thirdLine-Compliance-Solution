package com.atheris.tenant.modules.auth.repository;

import com.atheris.tenant.modules.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {
    Optional<RefreshToken> findByTokenHash(String hash);

    List<RefreshToken> findByUserIdAndIsRevokedFalse(Integer userId);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET is_revoked = true, revoked_at = :now, revoked_reason = :reason WHERE token_id = :id", nativeQuery = true)
    void revoke(Integer id, String reason, Instant now);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET is_revoked = true, revoked_at = :now, revoked_reason = :reason WHERE user_id = :userId", nativeQuery = true)
    void revokeAllForUser(Integer userId, String reason, Instant now);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET last_used_at = :now WHERE token_id = :id", nativeQuery = true)
    void updateLastUsed(Integer id, Instant now);
}
