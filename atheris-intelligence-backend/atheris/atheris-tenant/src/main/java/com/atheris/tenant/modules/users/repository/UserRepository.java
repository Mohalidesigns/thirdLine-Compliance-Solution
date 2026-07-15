package com.atheris.tenant.modules.users.repository;

import com.atheris.tenant.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByIsActiveTrue();

    @Modifying
    @Query(value = "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = :id", nativeQuery = true)
    void resetFailedAttempts(Integer id);

    @Modifying
    @Query(value = "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE user_id = :id", nativeQuery = true)
    void incrementFailedAttempts(Integer id);

    @Modifying
    @Query(value = "UPDATE users SET locked_until = :until WHERE user_id = :id", nativeQuery = true)
    void lockAccount(Integer id, Instant until);

    @Modifying
    @Query(value = "UPDATE users SET last_login_at = :at, last_login_ip = :ip WHERE user_id = :id", nativeQuery = true)
    void updateLastLogin(Integer id, Instant at, String ip);

    @Modifying
    @Query(value = "UPDATE users SET password_hash = :hash, password_changed_at = :at, invite_status = 'active', email_verified = true WHERE user_id = :id", nativeQuery = true)
    void setPassword(Integer id, String hash, Instant at);

    @Modifying
    @Query(value = "UPDATE users SET is_active = false WHERE user_id = :id", nativeQuery = true)
    void deactivate(Integer id);
}
