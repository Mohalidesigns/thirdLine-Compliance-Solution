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
public class AdoptTemplateRequest {
    private Integer ownerUserId;
    private String title;
    @Builder.Default
    private List<Long> obligationIds = new ArrayList<>();
    @Builder.Default
    private List<Long> controlIds = new ArrayList<>();
}
