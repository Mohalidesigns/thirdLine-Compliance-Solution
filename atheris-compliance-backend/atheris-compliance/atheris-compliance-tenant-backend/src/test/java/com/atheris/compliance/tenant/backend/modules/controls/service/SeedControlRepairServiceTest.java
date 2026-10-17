package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Seeded controls re-banded from the platform, cadence and pending tests follow; touched controls kept. */
class SeedControlRepairServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 17);

    private static Control control(int id, String number, String risk) {
        return Control.builder().controlId(id).controlNumber(number).name(number)
            .inherentRisk(risk).residualRisk(risk).testFrequency("Monthly").testFrequencyDays(30)
            .residualLikelihood("Medium").residualImpact("Medium").residualRiskRating("High").build();
    }

    private static PlatformRegulationSeed.ControlItem platform(String number, String riskLevel) {
        return PlatformRegulationSeed.ControlItem.builder().controlNumber(number).riskLevel(riskLevel).build();
    }

    private static ControlTask task(int controlId, LocalDate due) {
        return ControlTask.builder().controlId(controlId).taskType(WorkflowStatus.TASK_TYPE_SCHEDULED_TEST)
            .status(WorkflowStatus.TASK_PENDING).escalationLevel(0).dueDate(due).build();
    }

    private static SeedControlRepairService.Result run(List<Control> controls, Set<Integer> tested,
                                                       Map<Integer, List<ControlTask>> tasks, List<ControlTask> moved,
                                                       PlatformRegulationSeed.ControlItem... items) {
        Map<String, PlatformRegulationSeed.ControlItem> platform = new HashMap<>();
        for (PlatformRegulationSeed.ControlItem i : items) platform.put(i.getControlNumber(), i);
        return SeedControlRepairService.apply(controls, platform, tested, tasks, TODAY, moved);
    }

    @Test
    void untouchedControlIsRebandedAndItsNextTestMovesWithTheCadence() {
        Control c = control(1, "CRMP C001", "Critical");
        ControlTask next = task(1, LocalDate.of(2026, 11, 15));
        List<ControlTask> moved = new ArrayList<>();

        SeedControlRepairService.Result r = run(List.of(c), Set.of(), Map.of(1, List.of(next)), moved,
            platform("CRMP C001", "High"));

        assertEquals("High", c.getInherentRisk(), "Medium x High = 12 is High, not Critical");
        assertEquals("High", c.getResidualRisk());
        assertEquals("Quarterly", c.getTestFrequency());
        assertEquals(90, c.getTestFrequencyDays());
        assertEquals(LocalDate.of(2027, 1, 14), next.getDueDate(), "same anchor, 90 instead of 30 days");
        assertEquals("Moderate", c.getResidualRiskRating(), "Medium x Medium = 9 is Moderate");
        assertEquals(List.of(next), moved);
        assertEquals(new SeedControlRepairService.Result(1, 1, 1, 1), r);
    }

    @Test
    void testedOrEditedControlsKeepTheirRiskAndCadence() {
        Control tested = control(1, "CRMP C001", "Critical");
        tested.setResidualRisk("Low");                  // a passed test lowered residual risk
        Control edited = control(2, "CRMP C002", "Low"); // a user set Low; the old band never gave Low for High
        Control custom = control(3, "CRMP C003", "Critical");
        custom.setTestFrequency("Weekly");              // a user-chosen cadence
        custom.setTestFrequencyDays(7);
        ControlTask customTask = task(3, LocalDate.of(2026, 10, 24));
        List<ControlTask> moved = new ArrayList<>();

        SeedControlRepairService.Result r = run(List.of(tested, edited, custom), Set.of(1),
            Map.of(3, List.of(customTask)), moved,
            platform("CRMP C001", "High"), platform("CRMP C002", "High"), platform("CRMP C003", "High"));

        assertEquals("Critical", tested.getInherentRisk());
        assertEquals("Low", edited.getInherentRisk());
        assertEquals("High", custom.getInherentRisk(), "risk re-banded");
        assertEquals("Weekly", custom.getTestFrequency(), "but a non-default cadence is kept");
        assertEquals(LocalDate.of(2026, 10, 24), customTask.getDueDate());
        assertTrue(moved.isEmpty());
        assertEquals(1, r.riskRebanded());
        assertEquals(0, r.cadenceChanged());
    }

    @Test
    void overdueOrEscalatedTestsAreNotMoved() {
        Control c = control(1, "CRMP C001", "Critical");
        ControlTask overdue = task(1, LocalDate.of(2026, 10, 1));
        ControlTask escalated = task(1, LocalDate.of(2026, 11, 1));
        escalated.setEscalationLevel(1);
        List<ControlTask> moved = new ArrayList<>();

        run(List.of(c), Set.of(), Map.of(1, List.of(overdue, escalated)), moved, platform("CRMP C001", "Moderate"));

        assertEquals("Semi-Annual", c.getTestFrequency());
        assertEquals(LocalDate.of(2026, 10, 1), overdue.getDueDate());
        assertEquals(LocalDate.of(2026, 11, 1), escalated.getDueDate());
        assertTrue(moved.isEmpty());
    }

    @Test
    void secondRunChangesNothing() {
        Control c = control(1, "CRMP C001", "Critical");
        ControlTask next = task(1, LocalDate.of(2026, 11, 15));
        Map<Integer, List<ControlTask>> tasks = Map.of(1, List.of(next));
        run(List.of(c), Set.of(), tasks, new ArrayList<>(), platform("CRMP C001", "High"));

        SeedControlRepairService.Result again = run(List.of(c), Set.of(), tasks, new ArrayList<>(), platform("CRMP C001", "High"));

        assertEquals(new SeedControlRepairService.Result(0, 0, 0, 0), again);
        assertEquals(LocalDate.of(2027, 1, 14), next.getDueDate());
    }

    @Test
    void stillCriticalAndNonSeededControlsAreLeftAlone() {
        Control critical = control(1, "CRMP C001", "Critical");
        Control own = control(2, "CTL-0001", "Critical");

        SeedControlRepairService.Result r = run(List.of(critical, own), Set.of(), Map.of(), new ArrayList<>(),
            platform("CRMP C001", "Critical"));

        assertEquals("Critical", critical.getInherentRisk());
        assertEquals("Monthly", critical.getTestFrequency());
        assertEquals("Critical", own.getInherentRisk());
        assertEquals(0, r.riskRebanded());
    }

    @Test
    void legacyBandsAreAlwaysAtLeastTheNewBand() {
        assertEquals(Set.of("Critical"), SeedControlRepairService.legacyBandsFor("High"));
        assertEquals(Set.of("Critical"), SeedControlRepairService.legacyBandsFor("Critical"));
        assertEquals(Set.of("Moderate", "High", "Critical"), SeedControlRepairService.legacyBandsFor("Moderate"));
        assertEquals(Set.of("Low", "Moderate"), SeedControlRepairService.legacyBandsFor("Low"));
    }
}
