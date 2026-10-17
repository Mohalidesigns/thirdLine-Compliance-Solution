package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.ComplianceScoreWeightsRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

/**
 * A small tenant shaped like the dashboard that exposed the bugs: controls with seeded residual
 * risk but almost no tests, returns overdue with none filed, obligations with missing area/act/risk.
 */
class DashboardFixture {

    static final LocalDate TODAY = LocalDate.now();

    final ObligationClassificationRepository classifications = mock(ObligationClassificationRepository.class);
    final ObligationRepository obligations = mock(ObligationRepository.class);
    final ControlRepository controls = mock(ControlRepository.class);
    final ControlTaskRepository tasks = mock(ControlTaskRepository.class);
    final ControlTestResultRepository tests = mock(ControlTestResultRepository.class);
    final FindingRepository findings = mock(FindingRepository.class);
    final ReturnFilingInstanceRepository returns = mock(ReturnFilingInstanceRepository.class);
    final RegulatorySanctionRepository sanctions = mock(RegulatorySanctionRepository.class);
    final ComplianceScoreWeightsRepository weights = mock(ComplianceScoreWeightsRepository.class);

    final List<Obligation> obligationRows = new ArrayList<>();
    final List<ObligationClassification> classificationRows = new ArrayList<>();
    final List<Control> controlRows = new ArrayList<>();
    final List<ControlTestResult> testRows = new ArrayList<>();
    final List<ControlTask> taskRows = new ArrayList<>();
    final List<Finding> findingRows = new ArrayList<>();
    final List<ReturnFilingInstance> returnRows = new ArrayList<>();

    DashboardFixture() {
        // obligations: area/act/risk deliberately incomplete
        obligation(1, "AML/CFT/CPF", "BOFIA 2020", "Critical", null, List.of(1));
        obligation(2, "AML/CFT/CPF", "BOFIA 2020", null, "High", List.of(2));
        obligation(3, null, "NDPA 2023", null, "Moderate", List.of(3));
        obligation(4, "Compliance Risk Management", null, null, null, List.of(4));   // unrated, no act, catch-all area
        obligation(5, "Data Protection", "NDPA 2023", "Low", null, List.of());        // gap

        // controls: residual risk is a seeded copy of inherent — NOT a test result
        control(1, "High");
        control(2, "Critical");
        control(3, "Moderate");
        control(4, "High");
        test(3, TODAY.minusDays(10), "Passed", 1L);
        test(4, TODAY.minusDays(20), "Passed", 2L);
        test(4, TODAY.minusDays(5), "Failed", 3L);   // latest for control 4
        task(1, TODAY.plusDays(10), "Pending");
        task(2, TODAY.minusDays(3), "Overdue");
        task(3, TODAY.plusDays(90), "Pending");

        // returns: overdue, not yet due, one filed on time
        instance(1, TODAY.minusDays(15), ReturnFilingStatus.NOT_STARTED);
        instance(2, TODAY.minusDays(2), ReturnFilingStatus.IN_PROGRESS);
        instance(3, TODAY.plusDays(5), ReturnFilingStatus.NOT_STARTED);
        instance(4, TODAY.plusDays(60), ReturnFilingStatus.NOT_STARTED);
        instance(5, TODAY.plusDays(20), ReturnFilingStatus.IN_PROGRESS);
        instance(6, TODAY.minusDays(30), ReturnFilingStatus.SUBMITTED);

        findingRows.add(Finding.builder().findingId(1L).severity("Medium").status("Open")
            .createdAt(Instant.now()).slaDays(30).remediationDeadline(TODAY.plusDays(20)).build());

        when(classifications.findAll()).thenReturn(classificationRows);
        when(obligations.findAll()).thenReturn(obligationRows);
        when(controls.findAll()).thenReturn(controlRows);
        when(tests.findAll()).thenReturn(testRows);
        when(tasks.findAll()).thenReturn(taskRows);
        when(findings.findAll()).thenReturn(findingRows);
        when(returns.findAll()).thenReturn(returnRows);
        when(sanctions.findAll()).thenReturn(List.of());
        when(weights.findFirstByOrderByWeightIdAsc()).thenReturn(Optional.empty());
    }

    ComplianceMetricsService metrics() {
        return new ComplianceMetricsService(classifications, obligations, controls, tasks, tests,
            findings, returns, sanctions, weights);
    }

    DashboardV2Service v2() {
        return new DashboardV2Service(null, null, classifications, obligations, null, null, null, null, null);
    }

    private void obligation(long id, String area, String act, String inherent, String tenant, List<Integer> controlIds) {
        obligationRows.add(Obligation.builder().obligationId(id).instrumentId(100L + id)
            .areaOfFocus(area).actName(act).source("seeded").build());
        classificationRows.add(ObligationClassification.builder().obligationId(id).instrumentId(100L + id)
            .applicability("applicable").inherentRiskRating(inherent).tenantRiskRating(tenant)
            .linkedControlIds(controlIds).build());
    }

    private void control(int id, String residual) {
        controlRows.add(Control.builder().controlId(id).residualRisk(residual).inherentRisk(residual).build());
    }

    private void test(int controlId, LocalDate date, String result, long testId) {
        testRows.add(ControlTestResult.builder().testId(testId).controlId(controlId).testDate(date).result(result).build());
    }

    private void task(int controlId, LocalDate due, String status) {
        taskRows.add(ControlTask.builder().controlId(controlId).dueDate(due).status(status).build());
    }

    private void instance(long id, LocalDate due, ReturnFilingStatus status) {
        returnRows.add(ReturnFilingInstance.builder().instanceId(id).returnId(id).dueDate(due).status(status).build());
    }
}
