package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;
import java.time.LocalDate;

/** {@code PUT /api/v1/returns/{returnId}/schedule}. Validated in {@code ReturnService.updateSchedule}. */
@Data
public class UpdateScheduleRequest {
    /** Frequency label or code, e.g. "Quarterly"; blank keeps the current one. */
    private String frequency;
    /** {@code DATE}, {@code OFFSET} or null (no rule — Daily / Weekly / Event-driven only). */
    private String ruleType;
    /** Required for DATE: the first due date; later periods follow it by the cycle. */
    private LocalDate firstDueDate;
    /** Required for OFFSET: days after each period end (Monthly 1–28; Quarterly / Semi-Annual / Annual 1–365). */
    private Integer daysAfterPeriodEnd;
    /** Days before the due date that preparation starts; null keeps the current value. */
    private Integer prepDays;
}
