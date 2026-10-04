package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Builder;
import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/** Result of {@code PUT /api/v1/returns/schedules}: the number of returns updated and their register rows. */
@Data @Builder
public class BulkScheduleResponse {
    private int updated;
    @Builder.Default
    private List<ReturnRegisterItem> items = new ArrayList<>();
}
