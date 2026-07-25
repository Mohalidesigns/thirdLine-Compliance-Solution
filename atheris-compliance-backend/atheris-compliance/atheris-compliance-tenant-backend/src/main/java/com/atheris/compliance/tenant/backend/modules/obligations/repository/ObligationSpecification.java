package com.atheris.compliance.tenant.backend.modules.obligations.repository;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class ObligationSpecification {

    public static Specification<ObligationClassification> withFilters(
            String applicability, String tenantRiskRating, Boolean hasGap,
            Integer assignedOwnerUserId, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (applicability != null && !applicability.isEmpty())
                predicates.add(cb.equal(root.get("applicability"), applicability));
            if (tenantRiskRating != null && !tenantRiskRating.isEmpty())
                predicates.add(cb.equal(root.get("tenantRiskRating"), tenantRiskRating));
            if (hasGap != null)
                predicates.add(cb.equal(root.get("hasGap"), hasGap));
            if (assignedOwnerUserId != null)
                predicates.add(cb.equal(root.get("assignedOwnerUserId"), assignedOwnerUserId));
            if (status != null && !status.isEmpty())
                predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
