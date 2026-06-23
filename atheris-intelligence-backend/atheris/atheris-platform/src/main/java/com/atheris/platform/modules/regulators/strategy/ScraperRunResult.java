package com.atheris.platform.modules.regulators.strategy;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ScraperRunResult {
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private String mode;
    private int foundLinks;
    private int newDocuments;
    private int skippedDocuments;
    private int failedDocuments;
    private List<String> errors;
    private int durationMs;
}
