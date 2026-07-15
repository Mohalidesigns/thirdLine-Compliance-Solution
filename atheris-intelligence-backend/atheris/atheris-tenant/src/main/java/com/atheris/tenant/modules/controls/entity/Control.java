package com.atheris.tenant.modules.controls.entity;

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
    @Column(nullable = false)
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    private String theme;
    private String controlType;
    @Column(columnDefinition = "text")
    private String whatItDoes;
    @Column(columnDefinition = "text")
    private String howTested;
    private Integer controlOwnerUserId;
    private String controlOwnerName;
    private String testFrequency;
    private Integer testFrequencyDays;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Long> linkedObligationIds;
    private String inherentRisk;
    private String residualRisk;
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
