package com.atheris.compliance.tenant.backend.modules.returns.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDate;

@Data
public class CreateReturnRequest {
    @NotBlank private String returnName;
    private String filingRegulator;
    private Long tenantRegulatorId;
    /** Optional — the governing act's platform regulation id. Linked obligations ground the return when absent. */
    private Long actId;
    private String returnType;
    private String frequency;
    /** Fixed-date due rule anchor. Mutually exclusive with {@link #dueDaysAfterPeriodEnd}. */
    private LocalDate filingDate;
    /** Due-rule kind: {@code DATE} (uses {@link #filingDate}) or {@code OFFSET} (uses {@link #dueDaysAfterPeriodEnd}). */
    private String ruleType;
    /** Offset due rule: days after the period end. */
    private Integer dueDaysAfterPeriodEnd;
    private Integer filingDeadlineOffsetDays;
    private String filingChannel;
    private Integer returnOwnerUserId;
    private String returnOwnerName;
    private String responsibleUnit;
    private String responsiblePerson;
    private java.util.List<String> responsibleUnits;
    private java.util.List<String> responsiblePersons;
    private Long escalationPolicyId;
}