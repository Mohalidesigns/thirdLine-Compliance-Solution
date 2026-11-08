package com.atheris.compliance.tenant.backend.modules.notifications.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.notifications.dto.NotificationTemplateDto;
import com.atheris.compliance.tenant.backend.modules.notifications.dto.NotificationTemplateRequest;
import com.atheris.compliance.tenant.backend.modules.notifications.entity.NotificationTemplate;
import com.atheris.compliance.tenant.backend.modules.notifications.repository.NotificationTemplateRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationTemplateService {

    private final NotificationTemplateRepository repo;
    private final AuditService audit;

    @PersistenceContext
    private EntityManager em;

    public List<NotificationTemplateDto> list() {
        return repo.findAllByOrderByTemplateKeyAsc().stream().map(this::toDto).toList();
    }

    public NotificationTemplateDto get(String key) {
        return toDto(load(key));
    }

    @Transactional
    public NotificationTemplateDto update(String key, NotificationTemplateRequest req, Integer userId) {
        try {
            NotificationTemplate template = load(key);
            if (req.getSubject() != null) template.setSubject(req.getSubject());
            if (req.getBody() != null) template.setBody(req.getBody());
            if (req.getCcOwner() != null) template.setCcOwner(req.getCcOwner());
            if (req.getIsActive() != null) template.setIsActive(req.getIsActive());
            template.setUpdatedByUserId(userId);
            template = repo.save(template);
            audit.log(userId, "notification_template_updated", "notification_template", template.getTemplateId(),
                Map.of("key", key));
            return toDto(template);
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public void ensure(String key, String subject, String body, boolean ccOwner) {
        if (repo.findByTemplateKey(key).isPresent()) return;
        repo.save(NotificationTemplate.builder()
            .templateKey(key).channel("EMAIL").subject(subject).body(body)
            .ccOwner(ccOwner).isActive(true).build());
    }

    @Transactional
    public void upgrade(String key, String previousBody, String subject, String body, boolean ccOwner) {
        NotificationTemplate template = repo.findByTemplateKey(key).orElse(null);
        if (template == null) {
            require(key, subject, body, ccOwner);
            return;
        }
        if (previousBody != null && !previousBody.equals(template.getBody())) return;
        template.setSubject(subject);
        template.setBody(body);
        template.setCcOwner(ccOwner);
        repo.save(template);
    }

    @Transactional
    public void require(String key, String subject, String body, boolean ccOwner) {
        if (repo.findByTemplateKey(key).isPresent()) return;
        repo.save(NotificationTemplate.builder()
            .templateKey(key).channel("EMAIL").subject(subject).body(body)
            .ccOwner(ccOwner).isActive(true).build());
    }

    public RenderedEmail render(String key, Map<String, String> vars) {
        NotificationTemplate template = repo.findByTemplateKey(key).orElse(null);
        if (template == null) {
            return new RenderedEmail(null, null, true);
        }
        boolean ccOwner = template.getCcOwner() == null || template.getCcOwner();
        return new RenderedEmail(
            TemplateRenderer.render(template.getSubject(), vars),
            TemplateRenderer.render(template.getBody(), vars),
            ccOwner);
    }

    private NotificationTemplate load(String key) {
        return repo.findByTemplateKey(key)
            .orElseThrow(() -> ApiException.notFound("Notification template not found: " + key));
    }

    private NotificationTemplateDto toDto(NotificationTemplate t) {
        return NotificationTemplateDto.builder()
            .templateId(t.getTemplateId()).templateKey(t.getTemplateKey()).channel(t.getChannel())
            .subject(t.getSubject()).body(t.getBody()).ccOwner(t.getCcOwner())
            .isActive(t.getIsActive()).updatedAt(t.getUpdatedAt())
            .build();
    }

    private void rollback() {
        try { em.clear(); } catch (Throwable ignored) {}
        try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
    }

    private static RuntimeException rethrow(Throwable e) {
        return e instanceof RuntimeException r ? r : new RuntimeException(e);
    }

    public record RenderedEmail(String subject, String body, boolean ccOwner) {}
}
