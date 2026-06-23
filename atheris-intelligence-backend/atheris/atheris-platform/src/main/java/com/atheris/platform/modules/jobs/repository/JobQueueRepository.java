package com.atheris.platform.modules.jobs.repository;

import com.atheris.platform.modules.jobs.entity.JobQueue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface JobQueueRepository extends JpaRepository<JobQueue, Long> {

    @Query(value = """
        SELECT * FROM job_queue
        WHERE job_type = :jobType AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<JobQueue> claimOne(@Param("jobType") String jobType);

    @Query(value = """
        SELECT * FROM job_queue
        WHERE job_type = :jobType AND status = 'pending' AND priority = :priority
        ORDER BY created_at ASC LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<JobQueue> claimOneWithPriority(@Param("jobType") String jobType, @Param("priority") Integer priority);

    @Modifying @Query("UPDATE JobQueue j SET j.status='processing', j.startedAt=:now, j.attemptCount=j.attemptCount+1 WHERE j.jobId=:id")
    void markProcessing(@Param("id") Long id, @Param("now") Instant now);

    @Modifying @Query("UPDATE JobQueue j SET j.status='completed', j.completedAt=:now WHERE j.jobId=:id")
    void markCompleted(@Param("id") Long id, @Param("now") Instant now);

    @Modifying @Query("UPDATE JobQueue j SET j.status='failed', j.lastError=:error, j.nextRetryAt=:retry WHERE j.jobId=:id")
    void markFailed(@Param("id") Long id, @Param("error") String error, @Param("retry") Instant retry);

    @Query("SELECT COUNT(j) FROM JobQueue j WHERE j.status='pending' AND j.priority=:priority")
    int countPendingByPriority(@Param("priority") Integer priority);

    @Query("SELECT j FROM JobQueue j WHERE j.status='failed' AND j.attemptCount < j.maxAttempts AND j.nextRetryAt < :now ORDER BY j.nextRetryAt ASC")
    List<JobQueue> findDueForRetry(@Param("now") Instant now);

    @Query("SELECT j.jobType, COUNT(j) FROM JobQueue j WHERE j.status='pending' GROUP BY j.jobType")
    List<Object[]> countPendingByType();

    @Query("SELECT j FROM JobQueue j WHERE (:jobType IS NULL OR j.jobType = :jobType) AND (:status IS NULL OR j.status = :status) ORDER BY j.createdAt DESC")
    Page<JobQueue> listJobs(@Param("jobType") String jobType, @Param("status") String status, Pageable pageable);

    @Query("SELECT j.jobType, j.status, COUNT(j) FROM JobQueue j GROUP BY j.jobType, j.status ORDER BY j.jobType, j.status")
    List<Object[]> countByTypeAndStatus();

    long countByStatus(String status);
}
