package com.atheris.compliance.tenant.backend.modules.risks.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.requirements.service.ComplianceState;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public final class RiskResidual {

    private static final List<String> LIKELIHOODS =
        List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");

    private RiskResidual() {}

    public static String inherentBand(String likelihood, String impact) {
        return RiskBands.band(likelihood, impact);
    }

    public static Result compute(String inherentLikelihood, String inherentImpact,
                                 Collection<Integer> controlIds, Map<Integer, String> latestResultByControl) {
        if (inherentLikelihood == null || inherentImpact == null) {
            return new Result(null, null, null, "Risk not rated — set likelihood and impact.");
        }
        if (controlIds == null || controlIds.isEmpty()) {
            return new Result(inherentLikelihood, inherentImpact,
                RiskBands.band(inherentLikelihood, inherentImpact),
                "No control linked — residual equals inherent.");
        }
        long passed = controlIds.stream()
            .filter(id -> ComplianceState.effective(latestResultByControl.get(id))).count();
        boolean failed = controlIds.stream()
            .anyMatch(id -> ComplianceState.failed(latestResultByControl.get(id)));

        int drop = passed == controlIds.size() ? 2 : (passed * 2 >= controlIds.size() ? 1 : 0);
        int base = Math.max(1, LIKELIHOODS.indexOf(inherentLikelihood) + 1);
        int lowered = Math.max(1, base - drop);
        String residualLikelihood = LIKELIHOODS.get(lowered - 1);
        String reason;
        if (failed && drop == 0) {
            reason = "A linked control failed its latest test — likelihood held at " + residualLikelihood + ".";
        } else if (drop == 0) {
            reason = "Controls not yet proven effective — likelihood held at " + residualLikelihood + ".";
        } else {
            reason = passed + " of " + controlIds.size() + " controls passed — likelihood lowered to " + residualLikelihood + ".";
        }
        return new Result(residualLikelihood, inherentImpact,
            RiskBands.band(residualLikelihood, inherentImpact), reason);
    }

    public record Result(String likelihood, String impact, String band, String reason) {}
}