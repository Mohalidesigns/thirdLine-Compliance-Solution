package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UploadJobResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.UploadJob;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.UploadJobRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.IngestResponseDto;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service @Slf4j @RequiredArgsConstructor
public class UploadService {

    private final UploadJobRepository uploadJobs;
    private final TenantRegulatorRepository tenantRegulators;
    private final PlatformApiClient platformClient;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    @Transactional
    public UploadJobResponse uploadDocument(MultipartFile file, Long tenantRegulatorId,
                                            String title, String dateIssued) {
        if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
        if (!file.getContentType().contains("pdf"))
            throw new IllegalArgumentException("Only PDF files accepted");

        TenantRegulator reg = tenantRegulators.findByIdAndTenantId(tenantRegulatorId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Regulator not found"));

        if (!Boolean.TRUE.equals(reg.getIsActive()))
            throw new IllegalArgumentException("Regulator is not active");

        UUID uploadId = UUID.randomUUID();

        UploadJob job = UploadJob.builder()
            .uploadId(uploadId)
            .tenantId(tenantId)
            .tenantRegulatorId(tenantRegulatorId)
            .status("queued")
            .build();
        uploadJobs.save(job);

        IngestResponseDto result = platformClient.ingestDocument(
            file, tenantRegulatorId, tenantId,
            reg.getPlatformRegulatorId(), title, dateIssued);

        if (result.getError() != null) {
            job.setStatus("failed");
            job.setErrorMessage(result.getError());
        } else {
            job.setPlatformInstrumentId(result.getInstrumentId());
            job.setPlatformJobId(result.getJobId());
            job.setStatus(result.isDuplicate() ? "completed" : "processing");
        }
        uploadJobs.save(job);

        return UploadJobResponse.builder()
            .uploadId(uploadId)
            .status(job.getStatus())
            .platformInstrumentId(job.getPlatformInstrumentId())
            .errorMessage(job.getErrorMessage())
            .build();
    }

    public UploadJobResponse getUploadStatus(UUID uploadId) {
        UploadJob job = uploadJobs.findByUploadIdAndTenantId(uploadId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Upload not found"));

        if ("processing".equals(job.getStatus()) && job.getPlatformInstrumentId() != null) {
            PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(job.getPlatformInstrumentId());
            if (detail != null && detail.isCompleted()) {
                job.setStatus("completed");
                uploadJobs.save(job);
            }
        }

        return UploadJobResponse.builder()
            .uploadId(uploadId)
            .status(job.getStatus())
            .platformInstrumentId(job.getPlatformInstrumentId())
            .errorMessage(job.getErrorMessage())
            .build();
    }
}
