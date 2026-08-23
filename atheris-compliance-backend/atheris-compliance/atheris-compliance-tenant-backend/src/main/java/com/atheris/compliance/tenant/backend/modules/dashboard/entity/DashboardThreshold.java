package com.atheris.compliance.tenant.backend.modules.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "dashboard_thresholds", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "metric_name"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardThreshold {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long tenantId;
    @Column(nullable = false, length = 50)
    private String metricName;
    @Column(nullable = false)
    private double greenMin;
    @Column(nullable = false)
    private double amberMin;
}
