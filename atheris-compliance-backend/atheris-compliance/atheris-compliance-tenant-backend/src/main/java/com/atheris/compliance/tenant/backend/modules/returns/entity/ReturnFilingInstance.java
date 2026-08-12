package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "return_filing_instances")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnFilingInstance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long instanceId;
    @Column(nullable = false)
    private Long returnId;
    private String period;
    private LocalDate dueDate;
    private LocalDate prepStartDate;
    private ReturnStage currentStage = ReturnStage.NOT_STARTED;
    private ReturnFilingStatus status = ReturnFilingStatus.NOT_STARTED;
    private Integer stageOwnerUserId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String stageData;
    private String filingChannel;
    private LocalDate submittedDate;
    private Integer submittedByUserId;
    private String submissionEvidenceUrl;
    private Integer daysLate = 0;
    private Integer escalationLevel = 0;
    private Instant escalatedAt;
    @Column(columnDefinition = "text")
    private String notes;
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
