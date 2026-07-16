package com.atheris.platform.modules.jobs.service;

import com.atheris.platform.modules.jobs.entity.JobQueue;
import com.atheris.platform.modules.jobs.repository.JobQueueRepository;
import com.atheris.common.Constants;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
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

    @PersistenceContext
    private EntityManager em;

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
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<JobQueue> cq = cb.createQuery(JobQueue.class);
        Root<JobQueue> root = cq.from(JobQueue.class);
        cq.where(cb.and(
            cb.equal(root.get("jobType"), jobType),
            cb.equal(root.get("status"), Constants.STATUS_PENDING)
        ));
        cq.orderBy(cb.desc(root.get("priority")), cb.asc(root.get("createdAt")));
        var query = em.createQuery(cq);
        query.setMaxResults(1);
        query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        query.setHint("jakarta.persistence.lock.timeout", -2);
        var job = query.getResultStream().findFirst();
        job.ifPresent(j -> {
            j.setStatus(Constants.STATUS_PROCESSING);
            j.setStartedAt(Instant.now());
            j.setAttemptCount(j.getAttemptCount() != null ? j.getAttemptCount() + 1 : 1);
            repo.save(j);
        });
        return job;
    }

    @Transactional
    public Optional<JobQueue> claimOneWithPriority(String jobType, Integer priority) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<JobQueue> cq = cb.createQuery(JobQueue.class);
        Root<JobQueue> root = cq.from(JobQueue.class);
        cq.where(cb.and(
            cb.equal(root.get("jobType"), jobType),
            cb.equal(root.get("status"), Constants.STATUS_PENDING),
            cb.equal(root.get("priority"), priority)
        ));
        cq.orderBy(cb.asc(root.get("createdAt")));
        var query = em.createQuery(cq);
        query.setMaxResults(1);
        query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        query.setHint("jakarta.persistence.lock.timeout", -2);
        var job = query.getResultStream().findFirst();
        job.ifPresent(j -> {
            j.setStatus(Constants.STATUS_PROCESSING);
            j.setStartedAt(Instant.now());
            j.setAttemptCount(j.getAttemptCount() != null ? j.getAttemptCount() + 1 : 1);
            repo.save(j);
        });
        return job;
    }

    @Transactional
    public void markCompleted(Long jobId) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(Constants.STATUS_COMPLETED);
            j.setCompletedAt(Instant.now());
            repo.save(j);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long jobId, String error, Integer attemptCount) {
        int attempt = attemptCount != null ? attemptCount : 0;
        Instant nextRetry = calculateNextRetry(attempt);
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(Constants.STATUS_FAILED);
            j.setLastError(error);
            j.setNextRetryAt(nextRetry);
            repo.save(j);
        });
        log.warn("Job {} failed (attempt {}). Next retry: {}", jobId, attempt, nextRetry);
    }

    private Instant calculateNextRetry(int attempt) {
        int minutes = Constants.RETRY_BACKOFF[Math.min(attempt, Constants.RETRY_BACKOFF.length - 1)];
        return Instant.now().plus(minutes, ChronoUnit.MINUTES);
    }
}
