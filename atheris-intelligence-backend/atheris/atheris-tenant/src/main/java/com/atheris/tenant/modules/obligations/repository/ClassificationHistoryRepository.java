package com.atheris.tenant.modules.obligations.repository;

import com.atheris.tenant.modules.obligations.entity.ClassificationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClassificationHistoryRepository extends JpaRepository<ClassificationHistory, Long>, JpaSpecificationExecutor<ClassificationHistory> {
    List<ClassificationHistory> findByInstrumentIdOrderByChangedAtDesc(Long instrumentId);
}
