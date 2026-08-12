package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;
import java.util.List;

@Data
public class LinkObligationsRequest {
    private List<Long> linkedObligationIds;
}