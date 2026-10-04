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
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status.trim())) {
                if ("active".equalsIgnoreCase(status.trim()))
                    // Active = anything not Closed; a null status counts as active.
                    predicates.add(cb.or(cb.isNull(root.get("status")),
                        cb.notEqual(root.get("status"), "Closed")));
                else
                    predicates.add(cb.equal(root.get("status"), status));
            }
            if (severity != null && !severity.isEmpty())
                predicates.add(cb.equal(root.get("severity"), severity));
            if (overdueOnly != null && overdueOnly) {
                // Overdue = deadline passed and not yet Remediated/Closed (null status counts as open).
                predicates.add(cb.lessThan(root.get("remediationDeadline"), java.time.LocalDate.now()));
                predicates.add(cb.or(cb.isNull(root.get("status")),
                    cb.not(root.get("status").in("Remediated", "Closed"))));
            }
            if (assignedToUserId != null)
                predicates.add(cb.equal(root.get("assignedToUserId"), assignedToUserId));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
