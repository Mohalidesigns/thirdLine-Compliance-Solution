package com.atheris.compliance.intelligence.backend.shared.audit;

import com.atheris.compliance.common.Constants;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.Map;

@Service @Slf4j @RequiredArgsConstructor
public class AuditService {

    private final PlatformAuditLogRepository auditRepo;
    private final ObjectMapper mapper;

    /**
     * Log any significant platform action.
     *
     * @param actorId  User ID who performed the action (null = system)
     * @param action   What happened e.g. "regulator_created", "instrument_uploaded"
     * @param subject  What was acted on e.g. "regulator", "instrument", "tenant"
     * @param subjectId  ID of the subject
     * @param metadata  Any additional key-value context
     */
    public void log(Integer actorId, String action, String subject,
                    Long subjectId, Map<String, Object> metadata) {
        try {
            auditRepo.save(PlatformAuditLog.builder()
                .actorId(actorId)
                .actorType(actorId == null ? Constants.AUDIT_SOURCE_SYSTEM : Constants.AUDIT_SOURCE_USER)
                .action(action)
                .subjectType(subject)
                .subjectId(subjectId)
                .metadataJson(mapper.writeValueAsString(metadata))
                .occurredAt(Instant.now())
                .build());
        } catch (Exception e) {
            // Audit logging must never crash the main operation
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }
}
