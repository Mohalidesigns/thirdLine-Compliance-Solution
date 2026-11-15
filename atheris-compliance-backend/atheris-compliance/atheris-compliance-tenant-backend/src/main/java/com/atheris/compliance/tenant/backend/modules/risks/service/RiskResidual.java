package com.atheris.compliance.tenant.backend.modules.risks.service;

import com.atheris.compliance.tenant.backend.shared.util.BandThresholds;
import com.atheris.compliance.tenant.backend.modules.requirements.service.ComplianceState;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public final class RiskResidual {

    private static final List<String> LIKELIHOODS =
        List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");
    private static final List<String> IMPACTS =
        List.of("Insignificant", "Minor", "Moderate", "Major", "Severe");

    private RiskResidual() {}

    public static String inherentBand(String likelihood, String impact) {
        return BandThresholds.bandByLabels(likelihood, impact);
    }

    public static Result compute(String inherentLikelihood, String inherentImpact,
                                 Collection<Integer> controlIds, Map<Integer, String> latestResultByControl) {
        return compute(inherentLikelihood, inherentImpact, controlIds, latestResultByControl, ResidualRule.defaults());
    }

    public static Result compute(String inherentLikelihood, String inherentImpact,
                                 Collection<Integer> controlIds, Map<Integer, String> latestResultByControl,
                                 ResidualRule rule) {
        if (inherentLikelihood == null || inherentImpact == null) {
            return new Result(null, null, null, "Risk not rated — set likelihood and impact.");
        }
        if (controlIds == null || controlIds.isEmpty()) {
            return new Result(inherentLikelihood, inherentImpact,
                BandThresholds.bandByLabels(inherentLikelihood, inherentImpact),
                "No control linked — residual equals inherent.");
        }
        ResidualRule r = rule == null ? ResidualRule.defaults() : rule;
        long passed = controlIds.stream()
            .filter(id -> isTarget(latestResultByControl.get(id), r)).count();
        boolean failed = controlIds.stream()
            .anyMatch(id -> isFailed(latestResultByControl.get(id)));

        int drop = passed == controlIds.size() ? r.allDrop()
            : (passed * 2 >= controlIds.size() ? r.majorityDrop() : 0);

        String resLikelihood = inherentLikelihood;
        String resImpact = inherentImpact;
        if (r.targetsLikelihood()) resLikelihood = lower(LIKELIHOODS, inherentLikelihood, drop, r.floor());
        if (r.targetsImpact()) resImpact = lower(IMPACTS, inherentImpact, drop, r.floor());

        String reason;
        String measured = r.targetsLikelihood() ? resLikelihood : resImpact;
        if (drop == 0 && failed) {
            reason = "A linked control failed its latest test — residual held at " + measured + ".";
        } else if (drop == 0) {
            reason = "Controls not yet proven effective — residual held at " + measured + ".";
        } else {
            reason = passed + " of " + controlIds.size() + " controls passed — residual lowered by " + drop
                + " to " + measured + ".";
        }
        return new Result(resLikelihood, resImpact, BandThresholds.bandByLabels(resLikelihood, resImpact), reason);
    }

    private static boolean isTarget(String result, ResidualRule rule) {
        if (ComplianceState.effective(result)) return true;
        return rule.lenientTarget() && ComplianceState.PARTIAL.equalsIgnoreCase(result == null ? "" : result);
    }

    private static boolean isFailed(String result) {
        return ComplianceState.failed(result);
    }

    private static String lower(List<String> levels, String value, int drop, int floor) {
        int base = levels.indexOf(value) + 1;
        if (base == 0) return value;
        int lowered = Math.max(floor, base - drop);
        return levels.get(lowered - 1);
    }

    public record Result(String likelihood, String impact, String band, String reason) {}
}