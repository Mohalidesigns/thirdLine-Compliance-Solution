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
public class FrameworkDto {
    private Integer frameworkId;
    private String code;
    private String name;
    private String issuer;
    private String jurisdiction;
    private String versionLabel;
    private String sourceUrl;
    private Boolean internal;
    private Long clauseCount;
}
