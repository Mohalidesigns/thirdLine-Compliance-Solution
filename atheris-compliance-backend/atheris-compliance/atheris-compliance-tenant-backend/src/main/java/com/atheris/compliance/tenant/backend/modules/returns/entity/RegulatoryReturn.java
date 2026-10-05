package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

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
    private Long tenantRegulatorId;
    private Long actId;
    private String actName;
    private Integer departmentId;
    private String returnType;
    private String frequency;
    @Builder.Default
    private String frequencyType = "MONTHLY";
    @Builder.Default
    private RegulatoryReturnStatus status = RegulatoryReturnStatus.ACTIVE;
    private LocalDate filingDate;
    private Integer filingDeadlineOffsetDays;
    /** Offset rule: each instance is due this many days after its (calendar-aligned) period end. Exclusive with {@link #filingDate}. */
    private Integer dueDaysAfterPeriodEnd;
    /** Who set the due rule: {@code platform_text} (parsed), {@code user}, or null (unknown). */
    @Column(length = 20)
    private String dueDateSource;
    /** The platform's deadline wording, kept as a hint for people setting a due date. */
    @Column(columnDefinition = "text")
    private String deadlineText;
    @Column(length = 255)
    private String eventTriggerLabel;
    @Column(length = 20)
    private String eventDeadlineMode;
    private Integer eventDeadlineDays;
    @Column(length = 20)
    private String eventDeadlineUnit;
    private String filingChannel;
    private Integer returnOwnerUserId;
    private String returnOwnerName;
    private String responsibleUnit;
    private String responsiblePerson;
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
