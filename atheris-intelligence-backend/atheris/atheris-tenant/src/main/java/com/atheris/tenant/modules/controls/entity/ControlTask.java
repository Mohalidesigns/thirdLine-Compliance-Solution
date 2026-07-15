package com.atheris.tenant.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "control_tasks")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControlTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long taskId;
    @Column(nullable = false)
    private Integer controlId;
    private String controlNumber;
    private String controlName;
    private String taskType;
    private Integer assignedToUserId;
    private String assignedToName;
    private LocalDate dueDate;
    private String status = "Pending";
    private Integer escalationLevel = 0;
    private Instant escalatedAt;
    private Long completedByTestId;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
