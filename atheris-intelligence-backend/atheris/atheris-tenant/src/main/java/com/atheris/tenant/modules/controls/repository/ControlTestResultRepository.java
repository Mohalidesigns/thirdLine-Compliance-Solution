package com.atheris.tenant.modules.controls.repository;

import com.atheris.tenant.modules.controls.entity.ControlTestResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControlTestResultRepository extends JpaRepository<ControlTestResult, Long> {
    List<ControlTestResult> findByControlIdOrderByTestDateDesc(Integer controlId);
    Optional<ControlTestResult> findTopByControlIdOrderByTestDateDesc(Integer controlId);
    List<ControlTestResult> findByReviewStatus(String reviewStatus);

    @Query(value = "SELECT * FROM control_test_results WHERE remediation_required = true AND remediation_deadline < CURRENT_DATE", nativeQuery = true)
    List<ControlTestResult> findOverdueRemediation();
}
