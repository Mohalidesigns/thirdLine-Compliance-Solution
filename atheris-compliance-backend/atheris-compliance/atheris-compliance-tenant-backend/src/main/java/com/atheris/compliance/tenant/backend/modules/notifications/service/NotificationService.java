package com.atheris.compliance.tenant.backend.modules.notifications.service;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.ObligationNotification;
import com.atheris.compliance.tenant.backend.modules.notifications.repository.ObligationNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final ObligationNotificationRepository repo;

    public List<ObligationNotification> findAll() { return repo.findAll(); }

    public List<ObligationNotification> findUnread() {
        return repo.findByStatusOrderByCreatedAtDesc("unread");
    }

    public List<ObligationNotification> findByStatus(String status) {
        return "unread".equals(status) ? findUnread() : repo.findAll();
    }

    public Map<String, Long> getCount() {
        return Map.of(
            "unread", repo.countByStatus("unread"),
            "high_severity_unread", (long) repo.findByChangeSeverityAndStatus("high", "unread").size()
        );
    }

    public ObligationNotification findById(Long id) {
        return repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Notification not found"));
    }

    @Transactional
    public void markRead(Long id) {
        repo.findById(id).ifPresent(n -> {
            n.setStatus("read");
            n.setReadAt(Instant.now());
            repo.save(n);
        });
    }

    @Transactional
    public void acknowledge(Long id, Integer userId) {
        repo.findById(id).ifPresent(n -> {
            n.setStatus("acknowledged");
            n.setAcknowledgedAt(Instant.now());
            n.setAcknowledgedByUserId(userId);
            repo.save(n);
        });
    }

    @Transactional
    public void markAllRead() {
        repo.findByStatusOrderByCreatedAtDesc("unread").forEach(n -> {
            n.setStatus("read");
            n.setReadAt(Instant.now());
            repo.save(n);
        });
    }
}
