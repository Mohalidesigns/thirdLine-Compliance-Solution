package com.atheris.compliance.tenant.backend.modules.holidays.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FederalPublicHolidayRequest {
    @NotNull private LocalDate holidayDate;
    private LocalDate observedDate;
    @NotBlank @Size(max = 200) private String name;
}
