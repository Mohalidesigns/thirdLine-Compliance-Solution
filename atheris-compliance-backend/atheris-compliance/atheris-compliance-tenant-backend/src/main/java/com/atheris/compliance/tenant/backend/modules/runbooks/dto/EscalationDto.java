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
public class EscalationDto {
    private Long escalationId;
    private Integer level;
    private String triggerType;
    private String notifyRole;
    private Integer notifyUserId;
    private String notifyChannel;
    private Integer waitMinutes;
    private String instructions;
}
