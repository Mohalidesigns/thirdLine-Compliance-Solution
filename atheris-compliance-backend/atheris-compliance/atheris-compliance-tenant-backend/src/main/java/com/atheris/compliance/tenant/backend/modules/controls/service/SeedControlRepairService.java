package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import com.atheris.compliance.tenant.backend.shared.util.ControlSchedule;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aligns controls seeded under the old toolkit risk band with the platform's re-banded ratings
 * (idempotent). The seed copied the platform {@code riskLevel} into inherent AND residual risk and
 * derived the test cadence from it, so inflated "Critical" controls were tested monthly.
 * <ul>
 *   <li><b>inherent/residual risk</b> — set to the platform's current band, only for an untouched
 *       control: no test results, residual still equal to inherent (as seeded), and its rating one
 *       the old band could have produced for the new band;</li>
 *   <li><b>test cadence</b> — re-derived from the new band when it is still the risk-tiered default
 *       of the old band; pending, unescalated scheduled tests keep their anchor and move by the
 *       change in cadence;</li>
 *   <li><b>residual risk rating</b> — re-banded from the control's own residual likelihood × impact
 *       while it still equals the old band.</li>
 * </ul>
 * Platform-seeded controls only (matched by control number).
 */
@Service
@RequiredArgsConstructor
public class SeedControlRepairService {

    private static final List<String> TOOLKIT_LABELS = List.of("Very Low", "Low", "Medium", "High", "Very High");

    private final ControlRepository controls;
    private final ControlTaskRepository tasks;
    private final ControlTestResultRepository testResults;

    public record Result(int riskRebanded, int cadenceChanged, int tasksRescheduled,
                         int residualRatingRebanded, int howTestedCleared) {}

    /** Runs inside the caller's transaction. */
    public Result repair(List<PlatformRegulationSeed> bundles) {
        Map<String, PlatformRegulationSeed.ControlItem> platform = platformControls(bundles);
        List<Control> seeded = controls.findAll().stream()
            .filter(c -> platform.containsKey(c.getControlNumber())).toList();
        if (seeded.isEmpty()) return new Result(0, 0, 0, 0, 0);
        List<Integer> ids = seeded.stream().map(Control::getControlId).toList();
        Set<Integer> tested = testResults.findByControlIdInOrderByTestDateDesc(ids).stream()
            .map(ControlTestResult::getControlId).collect(Collectors.toSet());
        Map<Integer, List<ControlTask>> pending = tasks.findByControlIdInAndStatus(ids, WorkflowStatus.TASK_PENDING)
            .stream().collect(Collectors.groupingBy(ControlTask::getControlId));

        List<ControlTask> moved = new ArrayList<>();
        Result r = apply(seeded, platform, tested, pending, LocalDate.now(), moved);
        controls.saveAll(seeded);
        tasks.saveAll(moved);
        return r;
    }

    static Map<String, PlatformRegulationSeed.ControlItem> platformControls(List<PlatformRegulationSeed> bundles) {
        Map<String, PlatformRegulationSeed.ControlItem> out = new HashMap<>();
        for (PlatformRegulationSeed b : bundles) {
            if (b.getControls() == null) continue;
            for (PlatformRegulationSeed.ControlItem c : b.getControls()) {
                if (c.getControlNumber() != null) out.putIfAbsent(c.getControlNumber(), c);
            }
        }
        return out;
    }

    /** Pure: mutates the given rows in place, adds rescheduled tasks to {@code moved}. */
    static Result apply(List<Control> seeded, Map<String, PlatformRegulationSeed.ControlItem> platform,
                        Set<Integer> tested, Map<Integer, List<ControlTask>> pendingTasks,
                        LocalDate today, List<ControlTask> moved) {
        int risk = 0, cadence = 0, rescheduled = 0, residualRating = 0, howTested = 0;
        for (Control c : seeded) {
            PlatformRegulationSeed.ControlItem p = platform.get(c.getControlNumber());
            if (p == null) continue;

            // The old seed copied the single toolkit control text into howTested as well as
            // description, so the detail page showed the same paragraph twice. Clear it back to
            // null only where it still equals the description — a howTested an analyst wrote is kept.
            if (c.getHowTested() != null && c.getHowTested().equals(c.getDescription())) {
                c.setHowTested(null);
                howTested++;
            }

            String rating = rebandIfLegacy(c.getResidualRiskRating(), c.getResidualLikelihood(), c.getResidualImpact());
            if (rating != null) {
                c.setResidualRiskRating(rating);
                residualRating++;
            }

            String band = p.getRiskLevel();
            String old = c.getInherentRisk();
            if (band == null || band.equals(old) || tested.contains(c.getControlId())
                    || !Objects.equals(old, c.getResidualRisk()) || !legacyBandsFor(band).contains(old)) continue;
            c.setInherentRisk(band);
            c.setResidualRisk(band);
            risk++;

            boolean defaultCadence = (p.getFrequency() == null || p.getFrequency().isBlank())
                && Objects.equals(c.getTestFrequency(), ControlSchedule.frequencyForRisk(old));
            if (!defaultCadence) continue;
            String frequency = ControlSchedule.frequencyForRisk(band);
            Integer days = ControlSchedule.daysForFrequency(frequency);
            Integer oldDays = c.getTestFrequencyDays();
            if (days == null || frequency.equals(c.getTestFrequency())) continue;
            c.setTestFrequency(frequency);
            c.setTestFrequencyDays(days);
            cadence++;
            if (oldDays == null) continue;
            for (ControlTask t : pendingTasks.getOrDefault(c.getControlId(), List.of())) {
                if (!untouchedFutureTest(t, today)) continue;
                LocalDate due = t.getDueDate().plusDays(days - oldDays);
                t.setDueDate(due.isBefore(today) ? today : due);
                moved.add(t);
                rescheduled++;
            }
        }
        return new Result(risk, cadence, rescheduled, residualRating, howTested);
    }

    private static boolean untouchedFutureTest(ControlTask t, LocalDate today) {
        return WorkflowStatus.TASK_TYPE_SCHEDULED_TEST.equals(t.getTaskType())
            && WorkflowStatus.TASK_PENDING.equals(t.getStatus())
            && t.getCompletedByTestId() == null
            && (t.getEscalationLevel() == null || t.getEscalationLevel() == 0)
            && t.getDueDate() != null && !t.getDueDate().isBefore(today);
    }

    /** The canonical band when {@code current} is still the old toolkit band and differs from it; else null. */
    static String rebandIfLegacy(String current, String likelihood, String impact) {
        String band = RiskBands.band(likelihood, impact);
        String legacy = RiskBands.legacyToolkitBand(likelihood, impact);
        if (band == null || legacy == null || band.equals(legacy)) return null;
        return legacy.equals(current) ? band : null;
    }

    /** Every rating the old toolkit band gave to a likelihood × impact that now bands as {@code band}. */
    static Set<String> legacyBandsFor(String band) {
        Set<String> out = new HashSet<>();
        for (String l : TOOLKIT_LABELS) {
            for (String i : TOOLKIT_LABELS) {
                if (band.equals(RiskBands.band(l, i))) out.add(RiskBands.legacyToolkitBand(l, i));
            }
        }
        return out;
    }
}
