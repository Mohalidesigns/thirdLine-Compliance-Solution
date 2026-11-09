package com.atheris.compliance.tenant.backend.modules.risks.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/** A risk is rated at the worst likelihood and impact among the obligations it covers. */
public final class RiskScoring {

    private RiskScoring() {}

    public static void apply(Risk risk, Collection<Obligation> covered) {
        String likelihood = worst(covered.stream().map(Obligation::getInherentLikelihood).toList());
        String impact = worst(covered.stream().map(Obligation::getInherentImpact).toList());
        risk.setInherentLikelihood(likelihood);
        risk.setInherentImpact(impact);
        risk.setInherentBand(likelihood == null || impact == null ? RiskBands.UNRATED : RiskBands.band(likelihood, impact));
    }

    private static String worst(List<String> labels) {
        return labels.stream()
            .filter(l -> l != null && RiskBands.level(l) > 0)
            .max(Comparator.comparingInt(RiskBands::level))
            .orElse(null);
    }
}
