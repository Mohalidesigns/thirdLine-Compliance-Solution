package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/** {@code PUT /api/v1/returns/schedules}. 1–500 items, no duplicate returnIds; validated in {@code ReturnService}. */
@Data
public class BulkScheduleRequest {
    private List<BulkScheduleItem> items = new ArrayList<>();
}
