package com.atheris.compliance.tenant.backend.modules.evidence.service;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service @Slf4j @RequiredArgsConstructor
public class EvidenceVaultService {

    private final EvidenceFileRepository repo;
    private final FileStorageService storage;

    public Page<EvidenceFile> list(Pageable p) {
        return repo.findAllByOrderByCreatedAtDesc(p);
    }

    public EvidenceFile getFile(Long id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("File not found: " + id));
    }

    public byte[] download(EvidenceFile f) throws Exception {
        return storage.load(f.getStoragePath());
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
