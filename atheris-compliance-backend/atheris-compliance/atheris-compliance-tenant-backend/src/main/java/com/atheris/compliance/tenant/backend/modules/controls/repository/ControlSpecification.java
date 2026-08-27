package com.atheris.compliance.tenant.backend.modules.controls.repository;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class ControlSpecification {

    public static Specification<Control> withFilters(
            String theme, String residualRisk, Integer ownerUserId, Integer ownerId, String status, String q, Integer actId, String actName) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (theme != null && !theme.isEmpty())
                predicates.add(cb.equal(root.get("theme"), theme));
            if (residualRisk != null && !residualRisk.isEmpty())
                predicates.add(cb.equal(root.get("residualRisk"), residualRisk));
            if (ownerUserId != null)
                predicates.add(cb.equal(root.get("controlOwnerUserId"), ownerUserId));
            if (ownerId != null)
                predicates.add(cb.equal(root.get("controlOwnerId"), ownerId));
            if (status != null && !status.isEmpty())
                predicates.add(cb.equal(root.get("status"), status));
            if (actId != null)
                predicates.add(cb.equal(root.get("actId"), actId));
            if (actName != null && !actName.isEmpty())
                predicates.add(cb.equal(root.get("actName"), actName));
            if (q != null && !q.isBlank()) {
                String ql = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("name")), ql),
                    cb.like(cb.lower(root.get("controlNumber")), ql),
                    cb.like(cb.lower(root.get("controlOwnerName")), ql),
                    cb.like(cb.lower(root.get("complianceArea")), ql),
                    cb.like(cb.lower(root.get("regulatoryRequirement")), ql)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
