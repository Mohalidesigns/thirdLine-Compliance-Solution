package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.common.obligations.ObligationKey;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;

import java.util.*;

/**
 * Translates the platform's obligation ids (what a seeded control's {@code linkedObligationIds}
 * refer to) into this tenant's obligation ids. The tenant does not store the platform id, so the
 * two are matched on the shared {@link ObligationKey} within one instrument.
 */
final class SeedLinks {

    private SeedLinks() {}

    static String key(Obligation o) {
        return ObligationKey.of(o.getTitle(), o.getSectionReference(), o.getDescription(), o.getPlainEnglishStatement());
    }

    static String key(PlatformRegulationSeed.ObligationItem o) {
        return ObligationKey.of(o.getTitle(), o.getSpecificSectionReference(), o.getDescription(), o.getPlainEnglishStatement());
    }

    /** platform obligation id → tenant obligation id, for the obligations of one instrument. */
    static Map<Long, Long> platformToTenant(List<PlatformRegulationSeed.ObligationItem> items,
                                            Collection<Obligation> tenantObligations) {
        Map<String, Long> tenantByKey = new HashMap<>();
        for (Obligation o : tenantObligations) {
            String k = key(o);
            if (k != null) tenantByKey.merge(k, o.getObligationId(), Math::min);
        }
        Map<Long, Long> out = new HashMap<>();
        if (items == null) return out;
        for (PlatformRegulationSeed.ObligationItem item : items) {
            if (item.getObligationId() == null) continue;
            String k = key(item);
            Long tenantId = k == null ? null : tenantByKey.get(k);
            if (tenantId != null) out.put(item.getObligationId(), tenantId);
        }
        return out;
    }

    /** "12,15" in platform ids → the matching tenant ids (ids with no tenant row are dropped). */
    static List<Long> translate(String platformCsv, Map<Long, Long> platformToTenant) {
        if (platformCsv == null || platformCsv.isBlank()) return new ArrayList<>();
        Set<Long> out = new LinkedHashSet<>();
        for (String part : platformCsv.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                Long tenantId = platformToTenant.get(Long.parseLong(t));
                if (tenantId != null) out.add(tenantId);
            } catch (NumberFormatException ignored) {
                // not an id — skip
            }
        }
        return new ArrayList<>(out);
    }
}
