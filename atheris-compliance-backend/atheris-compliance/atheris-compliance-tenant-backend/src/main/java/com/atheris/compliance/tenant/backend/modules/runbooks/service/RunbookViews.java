package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.runbooks.dto.ExecutionSummaryDto;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.ScheduleDto;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.ACTIVE_EXECUTION_STATUSES;

/** Entity → summary DTO mapping shared by the runbook and execution services (batch-loaded). */
@Component
@RequiredArgsConstructor
public class RunbookViews {

    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;

    public List<ExecutionSummaryDto> executionSummaries(List<RunbookExecution> rows) {
        if (rows.isEmpty()) return List.of();
        Map<Long, Runbook> rb = runbooks.findAllById(rows.stream().map(RunbookExecution::getRunbookId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(Runbook::getRunbookId, Function.identity()));
        Map<Long, RunbookVersion> vs = versions.findAllById(rows.stream().map(RunbookExecution::getVersionId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(RunbookVersion::getVersionId, Function.identity()));
        return rows.stream().map(e -> executionSummary(e, rb.get(e.getRunbookId()), vs.get(e.getVersionId()))).toList();
    }

    public ExecutionSummaryDto executionSummary(RunbookExecution e, Runbook rb, RunbookVersion v) {
        return ExecutionSummaryDto.builder()
            .executionId(e.getExecutionId()).executionRef(e.getExecutionRef()).runbookId(e.getRunbookId())
            .runbookCode(rb != null ? rb.getRunbookCode() : null).runbookTitle(rb != null ? rb.getTitle() : null)
            .criticality(rb != null ? rb.getCriticality() : null).slaMinutes(rb != null ? rb.getSlaMinutes() : null)
            .versionId(e.getVersionId()).versionNumber(v != null ? v.getVersionNumber() : null)
            .triggerType(e.getTriggerType()).triggerRefId(e.getTriggerRefId())
            .operatorUserId(e.getOperatorUserId()).operatorName(e.getOperatorName())
            .status(e.getStatus()).outcome(e.getOutcome())
            .startedAt(e.getStartedAt()).dueAt(e.getDueAt()).completedAt(e.getCompletedAt()).closedAt(e.getClosedAt())
            .stepsTotal(e.getStepsTotal()).stepsPassed(e.getStepsPassed()).stepsFailed(e.getStepsFailed())
            .stepsSkipped(e.getStepsSkipped()).evidenceCount(e.getEvidenceCount())
            .overdue(isOverdue(e)).findingId(e.getFindingId()).createdAt(e.getCreatedAt())
            .build();
    }

    public static boolean isOverdue(RunbookExecution e) {
        return e.getDueAt() != null && ACTIVE_EXECUTION_STATUSES.contains(e.getStatus()) && e.getDueAt().isBefore(Instant.now());
    }

    public ScheduleDto schedule(RunbookSchedule s, Map<Integer, String> names) {
        return ScheduleDto.builder()
            .scheduleId(s.getScheduleId()).runbookId(s.getRunbookId()).frequency(s.getFrequency())
            .timezone(s.getTimezone()).leadDays(s.getLeadDays()).assigneeUserId(s.getAssigneeUserId())
            .assigneeName(names.get(s.getAssigneeUserId())).assigneeRole(s.getAssigneeRole())
            .nextRunAt(s.getNextRunAt()).lastRunAt(s.getLastRunAt()).active(s.getIsActive())
            .skipHolidays(s.getSkipHolidays()).build();
    }
}
