package com.atheris.compliance.tenant.backend.modules.audit.repository;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class AuditSpecification {

    public static Specification<AuditEvent> withFilters(
            String subjectType, Long subjectId, Integer actorUserId,
            Instant dateFrom, Instant dateTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (subjectType != null && !subjectType.isEmpty())
                predicates.add(cb.equal(root.get("subjectType"), subjectType));
            if (subjectId != null)
                predicates.add(cb.equal(root.get("subjectId"), subjectId));
            if (actorUserId != null)
                predicates.add(cb.equal(root.get("actorUserId"), actorUserId));
            if (dateFrom != null)
                predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), dateFrom));
            if (dateTo != null)
                predicates.add(cb.lessThanOrEqualTo(root.get("occurredAt"), dateTo));
            query.orderBy(cb.desc(root.get("occurredAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
