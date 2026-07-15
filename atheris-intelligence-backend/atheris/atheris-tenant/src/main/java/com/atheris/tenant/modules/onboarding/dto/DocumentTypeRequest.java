package com.atheris.tenant.modules.onboarding.dto;

import lombok.Data;
import java.util.List;

@Data
public class DocumentTypeRequest {
    private List<String> subscribedDocumentTypes;
    private List<String> notificationRiskRatings;
}
