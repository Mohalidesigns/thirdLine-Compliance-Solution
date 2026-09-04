package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data @NoArgsConstructor @AllArgsConstructor
public class ObligationSanctionId implements Serializable {
    private Long obligationId;
    private Long sanctionId;
}
