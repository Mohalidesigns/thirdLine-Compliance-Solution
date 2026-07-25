package com.atheris.compliance.tenant.backend.modules.controls.repository;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class ControlSpecification {

    public static Specification<Control> withFilters(
            String theme, String residualRisk, Integer ownerUserId, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (theme != null && !theme.isEmpty())
                predicates.add(cb.equal(root.get("theme"), theme));
            if (residualRisk != null && !residualRisk.isEmpty())
                predicates.add(cb.equal(root.get("residualRisk"), residualRisk));
            if (ownerUserId != null)
                predicates.add(cb.equal(root.get("controlOwnerUserId"), ownerUserId));
            if (status != null && !status.isEmpty())
                predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
