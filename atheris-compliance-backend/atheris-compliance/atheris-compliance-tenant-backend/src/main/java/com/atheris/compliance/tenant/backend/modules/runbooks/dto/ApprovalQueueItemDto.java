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
public class ApprovalQueueItemDto {
    private Long runbookId;
    private String runbookCode;
    private String title;
    private String criticality;
    private String category;
    private Long versionId;
    private Integer versionNumber;
    private String changeSummary;
    private Integer authoredByUserId;
    private String authoredByName;
    private Instant submittedAt;
    private Long publishedVersionId;
    private Integer publishedVersionNumber;
}
