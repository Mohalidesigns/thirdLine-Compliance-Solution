package com.atheris.tenant.modules.returns.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "regulatory_returns")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegulatoryReturn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long returnId;
    @Column(nullable = false)
    private String returnName;
    private String filingRegulator;
    private String returnType;
    private String frequency;
    private String status = "Active";
    private Integer filingDueDayOfMonth;
    private Integer filingDeadlineOffsetDays;
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
