package com.atheris.compliance.tenant.backend.modules.runbooks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RollbackStepDto {
    private Long rollbackId;
    private Integer sortOrder;
    private Long reversesStepId;
    private String reversesStepCode;
    private String title;
    private String instructionMd;
    private String commandBlock;
    private String verification;
}
