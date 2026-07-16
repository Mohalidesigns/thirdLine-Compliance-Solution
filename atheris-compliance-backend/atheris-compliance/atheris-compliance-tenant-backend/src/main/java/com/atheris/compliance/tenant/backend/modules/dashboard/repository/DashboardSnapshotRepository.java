package com.atheris.compliance.tenant.backend.modules.dashboard.repository;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DashboardSnapshotRepository extends JpaRepository<DashboardSnapshot, Long>, JpaSpecificationExecutor<DashboardSnapshot> {
    Optional<DashboardSnapshot> findTopByOrderBySnapshotDateDesc();
    List<DashboardSnapshot> findTop12ByOrderBySnapshotDateDesc();
    Optional<DashboardSnapshot> findBySnapshotDate(LocalDate date);
}
