package com.atheris.compliance.tenant.backend.modules.holidays.dto;

import com.atheris.compliance.tenant.backend.modules.holidays.entity.FederalPublicHoliday;
import lombok.Builder;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class FederalPublicHolidayDto {
    private Long holidayId;
    private LocalDate holidayDate;
    private LocalDate observedDate;
    private String name;
    private String jurisdiction;

    public static FederalPublicHolidayDto from(FederalPublicHoliday holiday) {
        return FederalPublicHolidayDto.builder().holidayId(holiday.getHolidayId())
            .holidayDate(holiday.getHolidayDate()).observedDate(holiday.getObservedDate())
            .name(holiday.getName()).jurisdiction(holiday.getJurisdiction()).build();
    }
}
