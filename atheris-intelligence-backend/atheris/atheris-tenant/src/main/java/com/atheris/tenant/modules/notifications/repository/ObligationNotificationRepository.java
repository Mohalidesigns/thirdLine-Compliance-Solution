package com.atheris.tenant.modules.notifications.repository;

import com.atheris.tenant.modules.notifications.entity.ObligationNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ObligationNotificationRepository extends JpaRepository<ObligationNotification, Long> {
    List<ObligationNotification> findByStatusOrderByCreatedAtDesc(String status);
    List<ObligationNotification> findByChangeSeverityAndStatus(String severity, String status);
    long countByStatus(String status);
}
