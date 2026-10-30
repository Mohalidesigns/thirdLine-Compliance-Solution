package com.atheris.compliance.tenant.backend.modules.evidence.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service @Slf4j @RequiredArgsConstructor
public class EvidenceVaultService {

    private final EvidenceFileRepository repo;
    private final FileStorageService storage;
    private final ControlRepository controls;
    private final ControlTestResultRepository controlTests;
    private final FindingRepository findings;
    private final ReturnFilingInstanceRepository returnInstances;
    private final ObligationRepository obligations;

    /** Source types a user may link an upload to from the Evidence Vault / obligation detail. */
    public static final java.util.Set<String> USER_SOURCE_TYPES =
        java.util.Set.of("control", "control_test", "finding", "return_instance", "obligation");

    public Page<EvidenceFile> list(Pageable p) {
        return repo.findAllByOrderByCreatedAtDesc(p);
    }

    public List<EvidenceFile> listBySource(String sourceType, Long sourceId) {
        return repo.findBySourceTypeAndSourceId(sourceType, sourceId);
    }

    public EvidenceFile getFile(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Evidence file not found: " + id));
    }

    public byte[] download(EvidenceFile f) throws java.io.IOException {
        return storage.load(f.getStoragePath());
    }

    /**
     * User-facing upload: the optional link must name a known source type AND an existing record,
     * so evidence can never point at e.g. "control #999999". Internal callers (runbook steps,
     * remediation, return events) pass sources they already resolved and use {@link #upload}.
     */
    @Transactional
    public EvidenceFile uploadLinked(MultipartFile file, String sourceType, Long sourceId, String description,
                                     Integer userId) throws Exception {
        String type = sourceType == null || sourceType.isBlank() ? null : sourceType.trim().toLowerCase(java.util.Locale.ROOT);
        if (type == null && sourceId != null)
            throw ApiException.badRequest("source_type_required", "Choose what the evidence is linked to");
        if (type != null) {
            if (!USER_SOURCE_TYPES.contains(type))
                throw ApiException.badRequest("invalid_source_type", "Unknown source type: " + sourceType);
            if (sourceId == null)
                throw ApiException.badRequest("source_id_required", "Give the id of the " + type.replace('_', ' '));
            if (!sourceExists(type, sourceId))
                throw ApiException.badRequest("source_not_found", "No " + type.replace('_', ' ') + " #" + sourceId + " exists");
        }
        return upload(file, type, sourceId, description, userId);
    }

    private boolean sourceExists(String type, Long id) {
        return switch (type) {
            case "control" -> id <= Integer.MAX_VALUE && controls.existsById(id.intValue());
            case "control_test" -> controlTests.existsById(id);
            case "finding" -> findings.existsById(id);
            case "return_instance" -> returnInstances.existsById(id);
            case "obligation" -> obligations.existsById(id);
            default -> false;
        };
    }

    @Transactional
    public EvidenceFile upload(MultipartFile file, String sourceType, Long sourceId, String description, Integer userId) throws Exception {
        String storagePath = storage.store(file);
        EvidenceFile ef = EvidenceFile.builder()
            .fileName(storagePath.substring(storagePath.lastIndexOf(java.io.File.separator) + 1))
            .originalName(file.getOriginalFilename())
            .mimeType(file.getContentType())
            .fileSize(file.getSize())
            .storagePath(storagePath)
            .sourceType(sourceType).sourceId(sourceId)
            .description(description).uploadedByUserId(userId).build();
        return repo.save(ef);
    }
}
