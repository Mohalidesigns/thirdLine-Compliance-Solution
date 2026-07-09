package com.atheris.platform.modules.regulators.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatorPipelineStatsDto {
    private int discoveredCount;
    private int downloadedCount;
    private int extractedCount;
    private int classifiedCount;
    private List<PendingDownloadItem> failedDownloads;
    private int uploadedCount;
    private List<PendingDownloadItem> uploadedDocuments;
    private List<DocumentItem> downloadedDocuments;
    private List<DocumentItem> extractedDocuments;
    private List<ClassifiedDocumentItem> classifiedDocuments;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PendingDownloadItem {
        private Long id;
        private String title;
        private String sourceUrl;
        private String errorMessage;
        private String discoveredAt;
        private String jobStatus;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DocumentItem {
        private Long instrumentId;
        private String sourceTitle;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ClassifiedDocumentItem {
        private Long instrumentId;
        private String sourceTitle;
        private String status;
        private String riskRating;
    }
}
