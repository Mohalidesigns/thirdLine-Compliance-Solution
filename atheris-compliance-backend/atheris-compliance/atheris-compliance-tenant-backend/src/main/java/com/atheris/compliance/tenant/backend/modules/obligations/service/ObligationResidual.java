package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.tenant.backend.modules.requirements.service.ComplianceState;
import com.atheris.compliance.tenant.backend.modules.risk.service.ResidualRule;
import com.atheris.compliance.tenant.backend.shared.util.BandThresholds;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class ObligationResidual {

    private static final List<String> LIKELIHOODS =
        List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");
    private static final List<String> IMPACTS =
        List.of("Insignificant", "Minor", "Moderate", "Major", "Severe");
    private static final List<String> TOOLKIT =
        List.of("Very Low", "Low", "Medium", "High", "Very High");

    private ObligationResidual() {}

    public static String inherentBand(String impact, String likelihood) {
        return BandThresholds.bandByLabels(likelihood, impact);
    }

    public static Result compute(String impact, String likelihood,
                                 Collection<Integer> controlIds, Map<Integer, String> latestResultByControl) {
        return compute(impact, likelihood, controlIds, latestResultByControl, ResidualRule.defaults());
    }

    public static Result compute(String impact, String likelihood,
                                 Collection<Integer> controlIds, Map<Integer, String> latestResultByControl,
                                 ResidualRule rule) {
        if (impact == null || likelihood == null) {
            return new Result(null, null, null, "Risk not rated — set impact and likelihood.");
        }
        if (controlIds == null || controlIds.isEmpty()) {
            return new Result(impact, likelihood, BandThresholds.bandByLabels(likelihood, impact),
                "No control linked — residual equals inherent.");
        }
        ResidualRule r = rule == null ? ResidualRule.defaults() : rule;
        Map<Integer, String> results = latestResultByControl == null ? Map.of() : latestResultByControl;
        long passed = controlIds.stream().filter(id -> isTarget(results.get(id), r)).count();
        boolean failed = controlIds.stream().anyMatch(id -> isFailed(results.get(id)));

        int drop = passed == controlIds.size() ? r.allDrop()
            : (passed * 2 >= controlIds.size() ? r.majorityDrop() : 0);

        String resImpact = impact;
        String resLikelihood = likelihood;
        if (r.targetsLikelihood()) resLikelihood = lower(LIKELIHOODS, likelihood, drop, r.floor());
        if (r.targetsImpact()) resImpact = lower(IMPACTS, impact, drop, r.floor());

        String measured = r.targetsLikelihood() ? resLikelihood : resImpact;
        String reason;
        if (drop == 0 && failed) {
            reason = "A linked control failed its latest test — residual held at " + measured + ".";
        } else if (drop == 0) {
            reason = "Controls not yet proven effective — residual held at " + measured + ".";
        } else {
            reason = passed + " of " + controlIds.size() + " controls passed — residual lowered by " + drop
                + " to " + measured + ".";
        }
        return new Result(resImpact, resLikelihood, BandThresholds.bandByLabels(resLikelihood, resImpact), reason);
    }

    public static Map<Integer, String> latestResults(Map<Integer, String> latestResultByControl) {
        return latestResultByControl == null ? Map.of() : new HashMap<>(latestResultByControl);
    }

    private static boolean isTarget(String result, ResidualRule rule) {
        if (ComplianceState.effective(result)) return true;
        return rule.lenientTarget() && ComplianceState.PARTIAL.equalsIgnoreCase(result == null ? "" : result);
    }

    private static boolean isFailed(String result) {
        return ComplianceState.failed(result);
    }

    private static String lower(List<String> canonical, String value, int drop, int floor) {
        if (value == null) return null;
        int base = RiskBands.level(value);
        if (base == 0) return value;
        List<String> levels = contains(canonical, value) ? canonical : TOOLKIT;
        int lowered = Math.max(floor, base - drop);
        return levels.get(lowered - 1);
    }

    private static boolean contains(List<String> levels, String value) {
        return value != null && levels.stream().anyMatch(l -> l.equalsIgnoreCase(value));
    }

    public record Result(String impact, String likelihood, String band, String reason) {}
}