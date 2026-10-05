package com.atheris.compliance.tenant.backend.modules.returns.dto;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class RecordReturnEventRequest {
    @NotNull private LocalDate triggerDate;
    private LocalDate dueDate;
    @Size(max = 2000) private String reference;
    private Long evidenceFileId;
}
