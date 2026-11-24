package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateReturnRequest {
    private List<String> responsiblePersons;
    private List<Integer> responsibleStakeholderIds;
    private Integer returnOwnerUserId;
    private String returnOwnerName;
    private String returnOwnerEmail;
}
