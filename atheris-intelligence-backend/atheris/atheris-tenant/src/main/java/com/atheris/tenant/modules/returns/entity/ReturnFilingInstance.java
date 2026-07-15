package com.atheris.tenant.modules.returns.entity;

import jakarta.persistence.*;
import lombok.*;
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
    private String currentStage = "Not Started";
    private String status = "Not Started";
    private Integer stageOwnerUserId;
    private LocalDate submittedDate;
    private Integer submittedByUserId;
    private String submissionEvidenceUrl;
    private Integer daysLate = 0;
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
