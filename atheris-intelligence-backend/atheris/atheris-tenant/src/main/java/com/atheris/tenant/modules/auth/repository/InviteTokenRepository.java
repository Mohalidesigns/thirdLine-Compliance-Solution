package com.atheris.tenant.modules.auth.repository;

import com.atheris.tenant.modules.auth.entity.InviteToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface InviteTokenRepository extends JpaRepository<InviteToken, Integer> {
    Optional<InviteToken> findByTokenHash(String hash);

    @Modifying
    @Query(value = "UPDATE invite_tokens SET is_used = true, used_at = NOW() WHERE token_id = :id", nativeQuery = true)
    void markUsed(Integer id);
}
