package com.atheris.tenant.modules.users.repository;

import com.atheris.tenant.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByIsActiveTrue();

    @Modifying
    @Query(value = "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE user_id = :id", nativeQuery = true)
    void incrementFailedAttempts(Integer id);
}
