package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "areas_of_focus")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AreaOfFocus {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long areaId;
    @Column(nullable = false, unique = true, length = 255) private String name;
    @Column(columnDefinition = "text") private String description;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}