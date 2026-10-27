package com.atheris.compliance.tenant.backend.modules.notifications.service;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.ObligationNotification;
import com.atheris.compliance.tenant.backend.modules.notifications.repository.ObligationNotificationRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final ObligationNotificationRepository repo;
    private final UserRepository users;
    private final EmailService email;

    @Transactional
    public ObligationNotification notifyUser(Integer userId, String category, String severity,
                                             String summary, String link) {
        if (userId == null) {
            return null;
        }
        ObligationNotification n = ObligationNotification.builder()
            .recipientUserId(userId)
            .category(category)
            .changeSeverity(severity)
            .changeType(category)
            .changeSummary(summary)
            .link(link)
            .build();
        return repo.save(n);
    }

    @Transactional
    public ObligationNotification notifyRole(String role, String category, String severity,
                                             String summary, String link) {
        if (role == null) {
            return null;
        }
        return repo.save(ObligationNotification.builder()
            .recipientRole(role)
            .category(category)
            .changeSeverity(severity)
            .changeType(category)
            .changeSummary(summary)
            .link(link)
            .build());
    }

    @Transactional
    public void notifyUserEmailed(Integer userId, String category, String severity,
                                  String summary, String link, String subject) {
        notifyUser(userId, category, severity, summary, link);
        if (userId == null) {
            return;
        }
        users.findById(userId).map(User::getEmail).ifPresent(to ->
            email.send(to, subject, summary, absolute(link)));
    }

    @Transactional
    public void notifyRoleEmailed(String role, String category, String severity,
                                  String summary, String link, String subject) {
        notifyRoleEmailed(role, category, severity, summary, link, subject, null);
    }

    @Transactional
    public void notifyRoleEmailed(String role, String category, String severity,
                                  String summary, String link, String subject, String emailBody) {
        notifyRoleEmailed(role, category, severity, summary, link, subject, emailBody, null);
    }

    @Transactional
    public void notifyRoleEmailed(String role, String category, String severity,
                                  String summary, String link, String subject, String emailBody, List<String> cc) {
        notifyRole(role, category, severity, summary, link);
        String body = emailBody != null && !emailBody.isBlank() ? emailBody : summary;
        List<User> holders = users.findByRole(role);
        for (User u : holders) {
            if (Boolean.FALSE.equals(u.getIsActive())) {
                continue;
            }
            email.send(u.getEmail(), cc, subject, body, absolute(link));
        }
    }

    private String absolute(String link) {
        if (link == null || link.isBlank()) {
            return null;
        }
        if (link.startsWith("http")) {
            return link;
        }
        return email.baseUrl() + link;
    }

    public List<ObligationNotification> forUser(Integer userId, String role, String status) {
        Set<Long> seen = new LinkedHashSet<>();
        List<ObligationNotification> out = new ArrayList<>();
        boolean unreadOnly = NotificationConstants.STATUS_UNREAD.equals(status);

        List<ObligationNotification> mine = unreadOnly
            ? repo.findByRecipientUserIdAndStatusOrderByCreatedAtDesc(userId, NotificationConstants.STATUS_UNREAD)
            : repo.findByRecipientUserIdOrderByCreatedAtDesc(userId);
        for (ObligationNotification n : mine) {
            if (seen.add(n.getNotificationId())) {
                out.add(n);
            }
        }

        if (role != null) {
            List<ObligationNotification> broadcast = unreadOnly
                ? repo.findByRecipientRoleAndRecipientUserIdIsNullAndStatusOrderByCreatedAtDesc(role, NotificationConstants.STATUS_UNREAD)
                : repo.findByRecipientRoleAndRecipientUserIdIsNullOrderByCreatedAtDesc(role);
            for (ObligationNotification n : broadcast) {
                if (seen.add(n.getNotificationId())) {
                    out.add(n);
                }
            }
        }
        out.sort(Comparator.comparing(ObligationNotification::getCreatedAt).reversed());
        return out;
    }

    public Map<String, Long> countForUser(Integer userId, String role) {
        long unread = repo.countByRecipientUserIdAndStatus(userId, NotificationConstants.STATUS_UNREAD);
        long highUnread = repo.findByRecipientUserIdAndStatusOrderByCreatedAtDesc(userId, NotificationConstants.STATUS_UNREAD).stream()
            .filter(n -> NotificationConstants.SEVERITY_HIGH.equalsIgnoreCase(n.getChangeSeverity())).count();
        if (role != null) {
            unread += repo.countByRecipientRoleAndRecipientUserIdIsNullAndStatus(role, NotificationConstants.STATUS_UNREAD);
            highUnread += repo.findByRecipientRoleAndRecipientUserIdIsNullAndStatusOrderByCreatedAtDesc(role, NotificationConstants.STATUS_UNREAD).stream()
                .filter(n -> NotificationConstants.SEVERITY_HIGH.equalsIgnoreCase(n.getChangeSeverity())).count();
        }
        return Map.of("unread", unread, "high_severity_unread", highUnread);
    }

    public ObligationNotification findById(Long id) {
        return repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Notification not found"));
    }

    @Transactional
    public void markRead(Long id) {
        repo.findById(id).ifPresent(n -> {
            n.setStatus(NotificationConstants.STATUS_READ);
            n.setReadAt(Instant.now());
            repo.save(n);
        });
    }

    @Transactional
    public void acknowledge(Long id, Integer userId) {
        repo.findById(id).ifPresent(n -> {
            n.setStatus(NotificationConstants.STATUS_ACKNOWLEDGED);
            n.setAcknowledgedAt(Instant.now());
            n.setAcknowledgedByUserId(userId);
            repo.save(n);
        });
    }

    @Transactional
    public void markAllRead(Integer userId, String role) {
        for (ObligationNotification n : forUser(userId, role, NotificationConstants.STATUS_UNREAD)) {
            n.setStatus(NotificationConstants.STATUS_READ);
            n.setReadAt(Instant.now());
            repo.save(n);
        }
    }
}