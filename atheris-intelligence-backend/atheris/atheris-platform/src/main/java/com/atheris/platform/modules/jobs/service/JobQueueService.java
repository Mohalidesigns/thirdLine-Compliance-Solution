package com.atheris.platform.modules.jobs.service;

import com.atheris.platform.modules.jobs.entity.JobQueue;
import com.atheris.platform.modules.jobs.repository.JobQueueRepository;
import com.atheris.common.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobQueueService {

    private final JobQueueRepository repo;

    @Transactional
    public Long enqueue(String jobType, Long subjectId, Integer priority,
                        Map<String, Object> payload, String createdBy) {
        JobQueue job = JobQueue.builder()
            .jobType(jobType)
            .subjectId(subjectId)
            .priority(priority)
            .payload(payload)
            .status(Constants.STATUS_PENDING)
            .createdByService(createdBy)
            .build();
        return repo.save(job).getJobId();
    }

    @Transactional
    public Long enqueue(String jobType, Long subjectId,
                        Map<String, Object> payload, String createdBy) {
        return enqueue(jobType, subjectId, 0, payload, createdBy);
    }

    @Transactional
    public Optional<JobQueue> claimOne(String jobType) {
        Optional<JobQueue> job = repo.claimOne(jobType);
        job.ifPresent(j -> repo.markProcessing(j.getJobId(), Instant.now()));
        return job;
    }

    @Transactional
    public Optional<JobQueue> claimOneWithPriority(String jobType, Integer priority) {
        Optional<JobQueue> job = repo.claimOneWithPriority(jobType, priority);
        job.ifPresent(j -> repo.markProcessing(j.getJobId(), Instant.now()));
        return job;
    }

    @Transactional
    public void markCompleted(Long jobId) {
        repo.markCompleted(jobId, Instant.now());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long jobId, String error, Integer attemptCount) {
        int attempt = attemptCount != null ? attemptCount : 0;
        Instant nextRetry = calculateNextRetry(attempt);
        repo.markFailed(jobId, error, nextRetry);
        log.warn("Job {} failed (attempt {}). Next retry: {}", jobId, attempt, nextRetry);
    }

    private Instant calculateNextRetry(int attempt) {
        int minutes = Constants.RETRY_BACKOFF[Math.min(attempt, Constants.RETRY_BACKOFF.length - 1)];
        return Instant.now().plus(minutes, ChronoUnit.MINUTES);
    }
}
