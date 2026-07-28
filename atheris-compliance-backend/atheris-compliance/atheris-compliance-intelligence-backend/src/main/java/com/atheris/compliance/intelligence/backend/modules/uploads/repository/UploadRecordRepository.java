package com.atheris.compliance.intelligence.backend.modules.uploads.repository;

import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UploadRecordRepository extends JpaRepository<UploadRecord, Long> {
    List<UploadRecord> findByStatusOrderByCreatedAtDesc(UploadStatus status);
    List<UploadRecord> findAllByOrderByCreatedAtDesc();
    Optional<UploadRecord> findBySha256Hash(String sha256Hash);
    long countByStatus(UploadStatus status);
}
