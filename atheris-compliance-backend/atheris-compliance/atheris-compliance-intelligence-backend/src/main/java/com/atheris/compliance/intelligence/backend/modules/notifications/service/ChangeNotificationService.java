package com.atheris.compliance.intelligence.backend.modules.notifications.service;

import com.atheris.compliance.intelligence.backend.modules.notifications.entity.ObligationWatch;
import com.atheris.compliance.intelligence.backend.modules.notifications.repository.ObligationWatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class ChangeNotificationService {

    private final ObligationWatchRepository watches;

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
}
