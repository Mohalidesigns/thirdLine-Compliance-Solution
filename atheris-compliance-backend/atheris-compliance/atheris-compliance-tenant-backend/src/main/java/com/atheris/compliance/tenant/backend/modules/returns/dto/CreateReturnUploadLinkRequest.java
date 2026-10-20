package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;

/** Optional recipient overrides when creating a public return-upload link. */
@Data
public class CreateReturnUploadLinkRequest {
    private String recipientEmail;
    private String recipientName;
}
