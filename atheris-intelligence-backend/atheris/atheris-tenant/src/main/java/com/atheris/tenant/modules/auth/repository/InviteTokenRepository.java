package com.atheris.tenant.modules.auth.repository;

import com.atheris.tenant.modules.auth.entity.InviteToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface InviteTokenRepository extends JpaRepository<InviteToken, Integer> {
    Optional<InviteToken> findByTokenHash(String hash);
}
