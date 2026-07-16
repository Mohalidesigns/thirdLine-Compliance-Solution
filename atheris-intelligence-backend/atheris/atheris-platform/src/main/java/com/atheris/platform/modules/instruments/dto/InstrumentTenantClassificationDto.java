package com.atheris.platform.modules.instruments.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data @Builder
public class InstrumentTenantClassificationDto {
    private Long instrumentId;
    private String sourceTitle;
    private String regulatorName;
    private String areaOfFocus;
    private String riskRating;
    private String aiSummary;
    private List<TenantClassification> tenantClassifications;

    @Data @Builder
    public static class TenantClassification {
        private Long tenantId;
        private String legalName;
        private String shortName;
        private String licenceType;
        private String classification;
        private Instant classifiedAt;
    }
}
