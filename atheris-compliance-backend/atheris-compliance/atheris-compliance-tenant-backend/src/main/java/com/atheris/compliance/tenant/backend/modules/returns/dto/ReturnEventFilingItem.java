package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import lombok.Builder;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReturnEventFilingItem {
    private Long instanceId;
    private LocalDate triggerDate;
    private String reference;
    private Long evidenceFileId;
    private LocalDate dueDate;
    private LocalDate unadjustedDueDate;
    private boolean dueDateAdjusted;
    private String status;
    private String triggerLabel;
    private String triggerType;

    public static ReturnEventFilingItem from(ReturnFilingInstance instance) {
        return ReturnEventFilingItem.builder().instanceId(instance.getInstanceId())
            .triggerDate(instance.getTriggerDate()).reference(instance.getEventReference())
            .evidenceFileId(instance.getEventEvidenceFileId()).dueDate(instance.getDueDate())
            .unadjustedDueDate(instance.getUnadjustedDueDate()).dueDateAdjusted(instance.isDueDateAdjusted())
            .status(instance.getStatus() == null ? null : instance.getStatus().db()).build();
    }
}
