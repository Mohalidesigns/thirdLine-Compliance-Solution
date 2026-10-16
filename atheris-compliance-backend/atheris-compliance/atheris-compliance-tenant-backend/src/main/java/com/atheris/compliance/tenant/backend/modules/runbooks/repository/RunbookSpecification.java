package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Criteria filters for the runbook library (GET /runbooks). */
public final class RunbookSpecification {

    private RunbookSpecification() {}

    public static Specification<Runbook> withFilters(String q, String category, String status, Integer frameworkId,
                                                     Integer ownerId, String criticality, String frequency,
                                                     Integer dueWithinDays, Boolean needsReview) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("title")), like), cb.like(cb.lower(root.get("runbookCode")), like)));
            }
            if (category != null && !category.isBlank()) p.add(cb.equal(root.get("category"), category));
            if (status != null && !status.isBlank()) {
                p.add(cb.equal(root.get("status"), status));
            } else {
                p.add(cb.notEqual(root.get("status"), "ARCHIVED"));
            }
            if (criticality != null && !criticality.isBlank()) p.add(cb.equal(root.get("criticality"), criticality));
            if (frequency != null && !frequency.isBlank()) p.add(cb.equal(root.get("frequency"), frequency));
            if (ownerId != null) p.add(cb.equal(root.get("ownerUserId"), ownerId));
            if (frameworkId != null) {
                Subquery<Long> sq = query.subquery(Long.class);
                Root<RunbookClauseMap> m = sq.from(RunbookClauseMap.class);
                Root<RunbookFrameworkClause> c = sq.from(RunbookFrameworkClause.class);
                sq.select(m.get("runbookId")).where(
                    cb.equal(m.get("clauseId"), c.get("clauseId")),
                    cb.equal(c.get("frameworkId"), frameworkId));
                p.add(root.get("runbookId").in(sq));
            }
            if (dueWithinDays != null) {
                Subquery<Long> sq = query.subquery(Long.class);
                Root<RunbookSchedule> s = sq.from(RunbookSchedule.class);
                sq.select(s.get("runbookId")).where(
                    cb.isTrue(s.get("isActive")),
                    cb.lessThanOrEqualTo(s.get("nextRunAt"), LocalDate.now().plusDays(dueWithinDays)));
                p.add(root.get("runbookId").in(sq));
            }
            if (Boolean.TRUE.equals(needsReview)) {
                Subquery<Long> sq = query.subquery(Long.class);
                Root<RunbookReviewSchedule> r = sq.from(RunbookReviewSchedule.class);
                sq.select(r.get("runbookId")).where(cb.lessThanOrEqualTo(r.get("nextReviewAt"), LocalDate.now()));
                p.add(root.get("runbookId").in(sq));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
