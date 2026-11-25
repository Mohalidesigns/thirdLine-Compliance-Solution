package com.atheris.compliance.tenant.backend.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "controls")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Control {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer controlId;
    @Column(nullable = false, unique = true)
    private String controlNumber;
    @Column(nullable = false, columnDefinition = "text")
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    private Integer controlThemeId;
    private String controlType;
    @Column(columnDefinition = "text")
    private String howTested;
    private String controlOwnerName;
    private Integer controlOwnerId;
    private Integer testerOwnerId;
    private Integer testerUserId;
    private String testerName;
    private Integer controlOwnerDepartmentId;
    private Integer controlOwnerTeamId;
    private Long escalationPolicyId;
    private String testFrequency;
    private java.time.LocalDate firstDueDate;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Long> linkedObligationIds;
    @Builder.Default
    private String status = "Active";
    private Integer createdByUserId;
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
