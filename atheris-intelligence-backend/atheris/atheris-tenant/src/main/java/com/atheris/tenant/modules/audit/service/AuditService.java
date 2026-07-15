package com.atheris.tenant.modules.audit.service;

import com.atheris.tenant.modules.audit.entity.AuditEvent;
import com.atheris.tenant.modules.audit.repository.AuditEventRepository;
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
    private final ObjectMapper mapper;

    public AuditEvent log(Integer actorUserId, String action, String subjectType, Long subjectId, Map<String, Object> afterData) {
        return log(actorUserId, action, subjectType, subjectId, null, afterData, null);
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
