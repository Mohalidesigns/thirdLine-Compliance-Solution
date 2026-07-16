package com.atheris.compliance.intelligence.backend.modules.instruments.dto;

import lombok.Data;
import java.util.List;

@Data
public class UpdateInstrumentRequest {
    private String areaOfFocus;
    private String nature;
    private String riskRating;
    private List<String> licenceTypesApplicable;
    private String aiSummary;
    private String status;
}
