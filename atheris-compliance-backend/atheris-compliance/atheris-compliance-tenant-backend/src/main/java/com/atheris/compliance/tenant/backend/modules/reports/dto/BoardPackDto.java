package com.atheris.compliance.tenant.backend.modules.reports.dto;

import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardPackDto {
    private Long boardPackId;
    private LocalDate periodFrom;
    private LocalDate periodTo;
    @Builder.Default private List<String> sections = List.of();
    private String status;              // DRAFT | SIGNED_OFF
    private Double complianceScore;
    private String fileName;
    private String fileSha256;
    private Integer generatedByUserId;
    private String generatedByName;
    private Instant generatedAt;
    private String signedOffByName;
    private Instant signedOffAt;
    private String signOffNote;
}