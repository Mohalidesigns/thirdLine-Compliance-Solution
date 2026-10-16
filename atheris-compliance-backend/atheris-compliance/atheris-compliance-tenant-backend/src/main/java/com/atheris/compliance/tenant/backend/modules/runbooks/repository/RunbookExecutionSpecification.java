package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.Runbook;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookExecution;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Criteria filters for the executions register (GET /runbooks/executions). */
public final class RunbookExecutionSpecification {

    private RunbookExecutionSpecification() {}

    public static Specification<RunbookExecution> withFilters(String q, String status, Long runbookId, Integer operatorId,
                                                              Instant from, Instant to, Boolean overdue) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (status != null && !status.isBlank()) p.add(cb.equal(root.get("status"), status));
            if (runbookId != null) p.add(cb.equal(root.get("runbookId"), runbookId));
            if (operatorId != null) p.add(cb.equal(root.get("operatorUserId"), operatorId));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to));
            if (Boolean.TRUE.equals(overdue)) {
                p.add(root.get("status").in(RunbookConstants.ACTIVE_EXECUTION_STATUSES));
                p.add(cb.lessThan(root.get("dueAt"), Instant.now()));
            }
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                Subquery<Long> sq = query.subquery(Long.class);
                Root<Runbook> rb = sq.from(Runbook.class);
                sq.select(rb.get("runbookId")).where(cb.or(
                    cb.like(cb.lower(rb.get("title")), like), cb.like(cb.lower(rb.get("runbookCode")), like)));
                p.add(cb.or(cb.like(cb.lower(root.get("executionRef")), like),
                    cb.like(cb.lower(root.get("operatorName")), like), root.get("runbookId").in(sq)));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
