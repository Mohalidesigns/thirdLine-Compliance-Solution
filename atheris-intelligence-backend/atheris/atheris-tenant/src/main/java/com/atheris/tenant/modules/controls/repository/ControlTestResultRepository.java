package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.ControlTestResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControlTestResultRepository extends JpaRepository<ControlTestResult, Long> {
    List<ControlTestResult> findByControlIdOrderByTestDateDesc(Integer controlId);
    Optional<ControlTestResult> findTopByControlIdOrderByTestDateDesc(Integer controlId);
    List<ControlTestResult> findByReviewStatus(String reviewStatus);
    List<ControlTestResult> findByRemediationRequiredTrueAndRemediationDeadlineBefore(LocalDate today);
}
