package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity @Table(name = "regulatory_returns")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatoryReturn {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long returnId;
    private Long actId;
    private Long instrumentId;
    @Column(nullable = false, length = 500) private String title;
    @Column(length = 255) private String sectionReference;
    @Column(columnDefinition = "text") private String statutoryBasis;
    @Column(length = 255) private String responsibleUnit;
    @Column(length = 255) private String responsiblePerson;
    @Column(length = 255) private String frequency;
    @Column(columnDefinition = "text") private String deadline;
    @Column(columnDefinition = "text") private String remarks;
    private LocalDate filingDate;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}