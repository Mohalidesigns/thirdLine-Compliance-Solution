package com.atheris.compliance.tenant.backend.modules.controls.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ControlTestLinkSentResponse {

    private String path;

    @Builder.Default
    private List<String> recipients = new ArrayList<>();

    @Builder.Default
    private List<String> cc = new ArrayList<>();

    private String subject;
    private String body;
}
