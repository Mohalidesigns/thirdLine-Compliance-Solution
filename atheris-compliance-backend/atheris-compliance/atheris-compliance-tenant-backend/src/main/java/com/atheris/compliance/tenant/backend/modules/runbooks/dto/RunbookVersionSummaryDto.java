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
public class RunbookVersionSummaryDto {
    private Long versionId;
    private Integer versionNumber;
    private String status;
    private String changeSummary;
    private String contentHash;
    private Integer authoredByUserId;
    private String authoredByName;
    private String approvedByName;
    private Instant approvedAt;
    private Instant publishedAt;
    private Instant createdAt;
    private Integer stepCount;
}
