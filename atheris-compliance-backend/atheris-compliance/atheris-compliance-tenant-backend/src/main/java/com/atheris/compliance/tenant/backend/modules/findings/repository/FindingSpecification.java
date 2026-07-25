package com.atheris.compliance.tenant.backend.modules.findings.repository;

import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import java.util.ArrayList;
import java.util.List;

public class FindingSpecification {

    public static Specification<Finding> withFilters(
            String status, String severity, Boolean overdueOnly, Integer assignedToUserId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isEmpty())
                predicates.add(cb.equal(root.get("status"), status));
            if (severity != null && !severity.isEmpty())
                predicates.add(cb.equal(root.get("severity"), severity));
            if (overdueOnly != null && overdueOnly)
                predicates.add(cb.lessThan(root.get("remediationDeadline"), java.time.LocalDate.now()));
            if (assignedToUserId != null)
                predicates.add(cb.equal(root.get("assignedToUserId"), assignedToUserId));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
