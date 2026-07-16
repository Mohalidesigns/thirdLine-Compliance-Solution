package com.atheris.compliance.intelligence.backend.modules.regulators.strategy;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class PdfLink {
    private String url;
    private String title;
    private String discoveredOnPage;
    private byte[] pdfBytes;
}
