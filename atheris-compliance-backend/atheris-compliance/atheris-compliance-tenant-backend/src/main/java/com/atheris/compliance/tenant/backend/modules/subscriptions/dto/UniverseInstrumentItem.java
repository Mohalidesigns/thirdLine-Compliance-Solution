package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

/** One row of the tenant Compliance Universe table. */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UniverseInstrumentItem {
    private Long instrumentId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private String regulatorName;
    private String regulatorAbbreviation;
    private String documentType;
    private String nature;
    private String areaOfFocus;
    private String riskRating;
    private String status;
    private LocalDate dateIssued;
    private int obligationCount;
}
