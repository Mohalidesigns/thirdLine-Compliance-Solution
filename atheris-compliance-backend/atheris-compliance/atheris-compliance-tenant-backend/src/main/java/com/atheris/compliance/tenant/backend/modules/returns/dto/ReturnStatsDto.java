package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data @Builder
public class ReturnStatsDto {
    private long total;
    private long overdue;
    private long inProgress;
    private long submitted;
    /**
     * Exhaustive status buckets over the tracked filing periods (event-driven ones only once
     * triggered): filedOnTime + filedLate + overdue + inProgressNotDue + notYetDue == tracked.
     */
    private StatusBuckets buckets;
    /** Active Monthly-or-longer returns with no due rule. */
    private long dueDateNeeded;
    private List<String> frequencies;
    private List<String> regulators;
    private List<String> actNames;
    /** Aliases consumed by the shared intel register config. */
    private long totalReturns;
    private long frequencyTypeCount;
    private long responsibleUnitCount;
    private long unassignedCount;
    /** Data-quality: active returns with no obligation link. */
    private long unlinkedCount;
    /** Data-quality: active returns with no governing act (should be 0 once act is enforced). */
    private long missingActCount;
    private Map<String, Long> byFrequencyType;
    private Map<String, Long> byResponsibleUnit;
    private List<String> frequencyTypes;
    private List<String> responsibleUnits;
    private List<ActOption> acts;

    @Data @Builder @AllArgsConstructor
    public static class StatusBuckets {
        private long tracked;
        private long filedOnTime;
        private long filedLate;
        private long overdue;
        private long inProgressNotDue;
        private long notYetDue;
        /** Unfiled periods due within the next 30 days (subset of inProgressNotDue + notYetDue). */
        private long dueSoon;
    }

    @Data @Builder @AllArgsConstructor
    public static class ActOption {
        private Long actId;
        private String name;
    }
}
