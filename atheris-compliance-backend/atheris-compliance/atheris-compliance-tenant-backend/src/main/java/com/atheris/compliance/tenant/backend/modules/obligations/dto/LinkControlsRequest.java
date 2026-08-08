package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Data;
import java.util.List;

@Data
public class LinkControlsRequest {
    private List<Integer> linkedControlIds;
    private String changeReason;
}
