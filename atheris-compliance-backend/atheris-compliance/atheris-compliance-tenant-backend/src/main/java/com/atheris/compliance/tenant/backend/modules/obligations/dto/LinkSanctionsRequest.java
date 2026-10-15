package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinkSanctionsRequest {
    @Builder.Default
    private List<Long> linkedSanctionIds = List.of();
}
