package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Data;
import java.util.List;

@Data
public class LinkReturnRequest {
    private List<Long> linkedReturnIds;
}
