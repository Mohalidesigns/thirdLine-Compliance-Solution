package com.atheris.compliance.tenant.backend.modules.evidence.repository;

import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EvidenceFileRepository extends JpaRepository<EvidenceFile, Long> {
    Page<EvidenceFile> findAllByOrderByCreatedAtDesc(Pageable p);
    List<EvidenceFile> findBySourceTypeAndSourceId(String sourceType, Long sourceId);
}
