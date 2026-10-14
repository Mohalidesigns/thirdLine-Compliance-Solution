package com.atheris.compliance.tenant.backend.modules.notifications.service;

import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Delivers an escalation to the right person by level:
 *   L1 → the assignee
 *   L2 → the assignee's manager ({@code User.managerUserId})
 *   L3 → every active CCO
 *
 * <p>In-app and email. Safe to call for a level that has no recipient: it simply
 * does nothing. Used by the returns catch-up and the control-task scheduler.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EscalationNotifier {

    private final UserRepository users;
    private final NotificationService notifications;

    public void escalate(int level, Integer assigneeUserId, String category,
                         String subject, String summary, String link) {
        if (level <= 0) return;
        if (level == 1) {
            notifyUser(assigneeUserId, category, subject, summary, link, 1);
        } else if (level == 2) {
            Integer managerId = resolveManager(assigneeUserId);
            if (managerId != null) {
                notifyUser(managerId, category, subject, summary, link, 2);
            } else {
                // No manager on record — fall back to the CCO so nothing is silently dropped.
                notifyCcos(category, subject, summary, link, 2);
            }
        } else {
            notifyCcos(category, subject, summary, link, level);
        }
    }

    private void notifyUser(Integer userId, String category, String subject, String summary, String link, int level) {
        if (userId == null) return;
        notifications.notifyUserEmailed(userId, category, NotificationConstants.SEVERITY_HIGH, "[L" + level + "] " + summary, link, subject);
    }

    private void notifyCcos(String category, String subject, String summary, String link, int level) {
        notifications.notifyRoleEmailed(AppRole.CCO, category, NotificationConstants.SEVERITY_HIGH, "[L" + level + "] " + summary, link, subject);
    }

    private Integer resolveManager(Integer userId) {
        if (userId == null) return null;
        return users.findById(userId).map(User::getManagerUserId).orElse(null);
    }
}