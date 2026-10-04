package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

/** One row of {@code PUT /api/v1/returns/schedules}: a return id plus the single-return schedule fields. */
@Data
@EqualsAndHashCode(callSuper = true)
public class BulkScheduleItem extends UpdateScheduleRequest {
    private Long returnId;
}
