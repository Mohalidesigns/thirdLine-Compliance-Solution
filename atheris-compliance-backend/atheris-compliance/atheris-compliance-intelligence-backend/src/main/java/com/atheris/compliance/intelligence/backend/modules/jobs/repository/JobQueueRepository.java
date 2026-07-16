package com.atheris.compliance.intelligence.backend.modules.jobs.repository;

import com.atheris.compliance.intelligence.backend.modules.jobs.entity.JobQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface JobQueueRepository extends JpaRepository<JobQueue, Long>, JpaSpecificationExecutor<JobQueue> {
    int countByStatusAndPriority(String status, Integer priority);
    long countByStatus(String status);
    Optional<JobQueue> findTopByCreatedByServiceOrderByCreatedAtDesc(String createdByService);
}
