package com.atheris.compliance.tenant.backend.modules.holidays.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "federal_public_holidays")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FederalPublicHoliday {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long holidayId;
    @Column(nullable = false)
    private Long tenantId;
    @Column(nullable = false)
    private LocalDate holidayDate;
    private LocalDate observedDate;
    @Column(nullable = false, length = 200)
    private String name;
    @Builder.Default
    @Column(nullable = false, length = 20)
    private String jurisdiction = "FEDERAL";
    @Builder.Default
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Builder.Default
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
