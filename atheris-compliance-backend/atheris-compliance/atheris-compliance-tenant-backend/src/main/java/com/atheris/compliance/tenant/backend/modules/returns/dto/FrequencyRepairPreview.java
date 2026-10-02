package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/** Dry run of the return frequency repair ({@code GET /api/v1/returns/frequency-repair}). Changes nothing. */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FrequencyRepairPreview {
    private int totalReturns;
    private int toRetype;
    private int unchanged;
    private int instancesToRemove;
    private int instancesKept;
    /** Only returns whose type will change, sorted by returnName. */
    @Builder.Default
    private List<Item> items = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        private Long returnId;
        private String returnName;
        private String regulator;
        /** Frequency text as written (never changed by the repair). */
        private String frequency;
        private String currentType;
        private String proposedType;
        /** {@code platform} or {@code frequency_text}. */
        private String source;
        private int removableInstances;
        private int keptInstances;
    }
}
