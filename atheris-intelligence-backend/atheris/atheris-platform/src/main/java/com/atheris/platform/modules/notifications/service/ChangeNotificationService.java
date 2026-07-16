package com.atheris.platform.modules.notifications.service;

import com.atheris.common.Constants;
import com.atheris.platform.modules.jobs.service.JobQueueService;
import com.atheris.platform.modules.notifications.entity.ObligationChange;
import com.atheris.platform.modules.notifications.entity.ObligationWatch;
import com.atheris.platform.modules.notifications.repository.ObligationChangeRepository;
import com.atheris.platform.modules.notifications.repository.ObligationWatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service @Slf4j @RequiredArgsConstructor
public class ChangeNotificationService {

    private final ObligationChangeRepository changes;
    private final ObligationWatchRepository watches;
    private final JobQueueService jobQueue;

    /**
     * Called by ClassificationService after re-classifying an instrument.
     * Records the change and queues notifications for all watching tenants.
     */
    @Transactional
    public void notifyWatchers(Long instrumentId, Map<String, Object> diff,
                                String changeType, String changeSummary) {
        String severity = computeSeverity(diff, changeType);

        ObligationChange change = changes.save(ObligationChange.builder()
            .instrumentId(instrumentId)
            .changeType(changeType)
            .changedFields(diff)
            .changeSummary(changeSummary)
            .changeSeverity(severity)
            .changedBy(Constants.CHANGE_TYPE_AI_RECLASSIFICATION)
            .build());

        List<ObligationWatch> watchers =
            watches.findByInstrumentIdAndIsWatchingTrue(instrumentId);

        if (watchers.isEmpty()) {
            log.info("No watchers for instrument {}. No notifications sent.", instrumentId);
            return;
        }

        log.info("Notifying {} watchers of change to instrument {}", watchers.size(), instrumentId);

        watchers.forEach(watcher ->
            jobQueue.enqueue(Constants.JOB_CHANGE_NOTIFICATION, instrumentId, 1,
                Map.of(
                    "tenant_id",       watcher.getTenantId(),
                    "change_id",       change.getChangeId(),
                    "watch_id",        watcher.getWatchId(),
                    "severity",        severity,
                    "notify_email",    watcher.getNotifyEmail(),
                    "notify_webhook",  watcher.getNotifyWebhook()
                ), "change-notification-service")
        );
    }

    /**
     * Create or update a watch when a tenant classifies an obligation.
     */
    @Transactional
    public ObligationWatch upsertWatch(Long instrumentId, Long tenantId,
                                        String classification, Integer userId) {
        ObligationWatch watch = watches
            .findByInstrumentIdAndTenantId(instrumentId, tenantId)
            .orElse(ObligationWatch.builder()
                .instrumentId(instrumentId)
                .tenantId(tenantId)
                .build());

        watch.setClassification(classification);
        watch.setClassifiedByUserId(userId);
        watch.setIsWatching(true);
        return watches.save(watch);
    }

    /**
     * Stop watching an obligation.
     */
    @Transactional
    public void removeWatch(Long instrumentId, Long tenantId) {
        watches.findByInstrumentIdAndTenantId(instrumentId, tenantId)
            .ifPresent(w -> { w.setIsWatching(false); watches.save(w); });
    }

    private String computeSeverity(Map<String, Object> diff, String changeType) {
        if (Constants.CHANGE_TYPE_SUPERSEDED.equals(changeType) || Constants.CHANGE_TYPE_APPLICABILITY_CLARIFIED.equals(changeType))
            return "high";

        if (diff.containsKey("risk_rating")) {
            @SuppressWarnings("unchecked")
            Map<String, String> ratingChange = (Map<String, String>) diff.get("risk_rating");
            String oldR = ratingChange.get("old");
            String newR = ratingChange.get("new");
            if (Constants.RISK_MEDIUM.equals(oldR) && Constants.RISK_HIGH.equals(newR)) return "high";
            if (Constants.RISK_LOW.equals(oldR) && Constants.RISK_HIGH.equals(newR)) return "high";
            if (Constants.RISK_LOW.equals(oldR) && Constants.RISK_MEDIUM.equals(newR)) return "medium";
        }
        if (diff.containsKey("obligations")) return "medium";
        if (diff.containsKey("sanctions"))   return "medium";
        return "low";
    }
}
