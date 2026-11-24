package com.atheris.compliance.tenant.backend.modules.audit.service;

import com.atheris.compliance.tenant.backend.modules.audit.dto.AuditEventItem;
import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import com.atheris.compliance.tenant.backend.modules.audit.repository.AuditEventRepository;
import com.atheris.compliance.tenant.backend.modules.audit.repository.AuditSpecification;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditService {

    private final AuditEventRepository repo;
    private final UserRepository users;
    private final ObjectMapper mapper;

    public AuditEvent log(Integer actorUserId, String action, String subjectType, Long subjectId, Map<String, Object> afterData) {
        return log(actorUserId, action, subjectType, subjectId, null, afterData, null);
    }

    /** Audits as the signed-in user (for services that are not handed the user). */
    public AuditEvent logCurrentUser(String action, String subjectType, Long subjectId, Map<String, Object> afterData) {
        Integer actor = null;
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof com.atheris.compliance.tenant.backend.modules.users.entity.User u)
            actor = u.getUserId();
        return log(actor, action, subjectType, subjectId, afterData);
    }

    public AuditEvent log(Integer actorUserId, String action, String subjectType, Long subjectId,
                          Object before, Object after, String evidenceUrl) {
        try {
            AuditEvent prev = repo.findTopByOrderByEventIdDesc().orElse(null);
            String prevHash = prev != null ? prev.getThisEventHash() : "0000000000000000";
            Long prevId = prev != null ? prev.getEventId() : null;
            String beforeJson = before != null ? mapper.writeValueAsString(before) : null;
            String afterJson = after != null ? mapper.writeValueAsString(after) : null;
            AuditEvent event = AuditEvent.builder()
                .actorUserId(actorUserId).action(action).subjectType(subjectType).subjectId(subjectId)
                .beforeJson(beforeJson).afterJson(afterJson).evidenceUrl(evidenceUrl)
                .previousEventId(prevId).previousEventHash(prevHash)
                .occurredAt(Instant.now()).build();
            String rowData = actorUserId + action + subjectType + subjectId
                + (afterJson != null ? afterJson : "") + event.getOccurredAt().toString();
            event.setThisEventHash(sha256(prevHash + rowData));
            return repo.save(event);
        } catch (Exception e) {
            log.error("Failed to write audit event: {}", e.getMessage());
            return null;
        }
    }

    public Page<AuditEventItem> search(
            List<String> subjectTypes, Long subjectId, Integer actorUserId,
            Instant dateFrom, Instant dateTo, Pageable p) {
        var spec = AuditSpecification.withFilters(subjectTypes, subjectId, actorUserId, dateFrom, dateTo);
        Page<AuditEvent> entities = repo.findAll(spec, p);
        Set<Integer> userIds = new HashSet<>();
        entities.forEach(e -> { if (e.getActorUserId() != null) userIds.add(e.getActorUserId()); });
        Map<Integer, String> nameMap = new HashMap<>();
        if (!userIds.isEmpty()) {
            users.findAllById(userIds).forEach(u -> nameMap.put(u.getUserId(), u.getFullName()));
        }
        return entities.map(e -> AuditEventItem.from(e, nameMap.getOrDefault(e.getActorUserId(), "System")));
    }

    public Page<AuditEvent> findBySubject(String subjectType, Long subjectId, Pageable p) {
        return repo.findBySubjectTypeAndSubjectIdOrderByOccurredAtDesc(subjectType, subjectId, p);
    }

    public Page<AuditEvent> findAll(Pageable p) {
        return repo.findAllByOrderByOccurredAtDesc(p);
    }

    public boolean verifyChain() {
        var all = repo.findAll(Sort.by("eventId"));
        String expected = "0000000000000000";
        for (AuditEvent e : all) {
            if (!expected.equals(e.getPreviousEventHash())) return false;
            expected = e.getThisEventHash();
        }
        return true;
    }

    private String sha256(String s) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
