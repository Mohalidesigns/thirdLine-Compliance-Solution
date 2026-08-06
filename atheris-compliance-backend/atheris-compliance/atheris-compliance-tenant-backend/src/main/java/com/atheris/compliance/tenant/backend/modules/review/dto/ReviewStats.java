package com.atheris.compliance.tenant.backend.modules.review.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ReviewStats {
    private long total;
    private long intel;
    private long upload;
    private List<String> regulators;
}
