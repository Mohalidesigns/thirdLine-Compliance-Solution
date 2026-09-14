package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Objects;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ObligationControlId implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long obligationId;
    private Long complianceControlId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ObligationControlId that = (ObligationControlId) o;
        return Objects.equals(obligationId, that.obligationId)
                && Objects.equals(complianceControlId, that.complianceControlId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(obligationId, complianceControlId);
    }
}
