package com.atheris.compliance.tenant.backend.modules.reports.dto;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignOffRequest {
    private String note;
}