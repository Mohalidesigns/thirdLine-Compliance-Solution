package com.atheris.compliance.tenant.backend.modules.notifications.repository;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, Long> {
    Optional<NotificationTemplate> findByTemplateKey(String templateKey);
    List<NotificationTemplate> findAllByOrderByTemplateKeyAsc();
}
