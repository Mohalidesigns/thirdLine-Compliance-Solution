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
public class EvidenceItemDto {
    private Long evidenceId;
    private Long stepExecId;
    private Long reqId;
    private String evidenceType;
    private Long fileId;
    private String fileName;
    private String mimeType;
    private Long fileSize;
    private String externalRef;
    private String attestationText;
    private String sha256;
    private Integer capturedByUserId;
    private String capturedByName;
    private Instant capturedAt;
}
