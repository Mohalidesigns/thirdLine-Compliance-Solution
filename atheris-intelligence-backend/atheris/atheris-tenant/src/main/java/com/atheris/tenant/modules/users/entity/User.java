package com.atheris.tenant.modules.users.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer userId;
    @Column(nullable = false, unique = true)
    private String email;
    @Column(nullable = false)
    private String fullName;
    private String jobTitle;
    private String department;
    private String passwordHash;
    @Column(nullable = false)
    private String role;
    private Integer managerUserId;
    private Boolean isActive = true;
    private Boolean emailVerified = false;
    private String inviteStatus = "pending";
    private Boolean mfaEnabled = false;
    private String mfaSecret;
    private Integer failedLoginAttempts = 0;
    private Instant lockedUntil;
    private Integer invitedByUserId;
    private Instant invitedAt;
    private Instant lastLoginAt;
    private String lastLoginIp;
    private Instant passwordChangedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
