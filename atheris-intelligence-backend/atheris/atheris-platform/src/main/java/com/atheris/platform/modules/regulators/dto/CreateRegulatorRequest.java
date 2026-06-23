package com.atheris.platform.modules.regulators.dto;

import com.atheris.common.Constants;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRegulatorRequest {
    @NotBlank private String name;
    @NotBlank private String abbreviation;
    private String websiteUrl;
    private String publicationPageUrl;
    private String scraperStrategy = Constants.STRATEGY_HTML;
    private String scraperFrequency = Constants.FREQ_DAILY;
    private String pdfLinkSelector;
    private Boolean paginationEnabled = false;
    private String paginationSelector;
    private String paginationStrategy;
    private Integer maxPagesPerRun = 3;
    private Integer maxPdfSizeMb = 100;
    private Boolean scraperEnabled = true;
}
