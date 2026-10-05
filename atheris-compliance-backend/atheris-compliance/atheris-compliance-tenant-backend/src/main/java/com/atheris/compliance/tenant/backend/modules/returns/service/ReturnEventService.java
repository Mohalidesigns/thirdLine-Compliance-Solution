package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.returns.dto.ConfigureEventTriggerRequest;
import com.atheris.compliance.tenant.backend.modules.returns.dto.RecordReturnEventRequest;
import com.atheris.compliance.tenant.backend.modules.returns.dto.ReturnEventFilingItem;
import com.atheris.compliance.tenant.backend.modules.returns.dto.ReturnRegisterItem;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.LocalDate;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class ReturnEventService {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final EvidenceFileRepository evidence;
    private final EvidenceVaultService evidenceVault;
    private final WorkingDayService workingDays;
    private final AuditService audit;
    @PersistenceContext private EntityManager em;

    @Transactional
    public ReturnRegisterItem configure(Long returnId, ConfigureEventTriggerRequest req, Integer userId) {
        try {
            RegulatoryReturn ret = getEventReturn(returnId);
            if (req == null) throw ApiException.badRequest("Request body is required");
            String label = req.getTriggerLabel() == null ? "" : req.getTriggerLabel().trim();
            if (label.isBlank() || label.length() > 255) throw ApiException.badRequest("Trigger label is required (maximum 255 characters).");
            String mode = upper(req.getDeadlineMode());
            if (!"OFFSET".equals(mode) && !"MANUAL".equals(mode)) throw ApiException.badRequest("deadlineMode must be OFFSET or MANUAL.");
            if ("MANUAL".equals(mode) && (req.getDeadlineDays() != null || req.getDeadlineUnit() != null))
                throw ApiException.badRequest("Manual due-date rules cannot include deadlineDays or deadlineUnit.");
            Integer days = req.getDeadlineDays();
            String unit = upper(req.getDeadlineUnit());
            if ("OFFSET".equals(mode)) {
                if (req.getDeadlineDays() == null || req.getDeadlineDays() < 1 || req.getDeadlineDays() > 365)
                    throw ApiException.badRequest("deadlineDays must be between 1 and 365.");
                if (!"WORKING".equals(unit) && !"CALENDAR".equals(unit))
                    throw ApiException.badRequest("deadlineUnit must be WORKING or CALENDAR.");
                days = req.getDeadlineDays();
            } else { days = null; unit = null; }
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("triggerLabel", ret.getEventTriggerLabel());
            before.put("deadlineMode", ret.getEventDeadlineMode());
            before.put("deadlineDays", ret.getEventDeadlineDays());
            before.put("deadlineUnit", ret.getEventDeadlineUnit());
            ret.setEventTriggerLabel(label); ret.setEventDeadlineMode(mode);
            ret.setEventDeadlineDays(days); ret.setEventDeadlineUnit(unit);
            returns.save(ret);
            audit.log(userId, "return_event_trigger_configured", "return", returnId, before,
                new java.util.LinkedHashMap<>(Map.of("triggerLabel", label, "deadlineMode", mode,
                    "deadlineDays", Objects.toString(days, ""), "deadlineUnit", Objects.toString(unit, ""))), null);
            return ReturnRegisterItem.builder().returnId(ret.getReturnId()).returnName(ret.getReturnName())
                .frequency(ret.getFrequency()).frequencyType(ret.getFrequencyType()).eventTriggerConfigured(true)
                .eventTriggerLabel(ret.getEventTriggerLabel()).eventDeadlineMode(ret.getEventDeadlineMode())
                .eventDeadlineDays(ret.getEventDeadlineDays()).eventDeadlineUnit(ret.getEventDeadlineUnit())
                .deadlineText(ret.getDeadlineText()).build();
        } catch (Throwable e) { rollback(e); throw rethrow(e); }
    }

    @Transactional
    public ReturnEventFilingItem record(Long returnId, RecordReturnEventRequest req, Integer userId) {
        try {
            return doRecord(returnId, req, userId);
        } catch (Throwable e) { rollback(e); throw rethrow(e); }
    }

    private ReturnEventFilingItem doRecord(Long returnId, RecordReturnEventRequest req, Integer userId) throws Exception {
            RegulatoryReturn ret = getEventReturn(returnId);
            if (req == null) throw ApiException.badRequest("Request body is required");
            if (ret.getEventTriggerLabel() == null || ret.getEventTriggerLabel().isBlank())
                throw ApiException.conflict("trigger_not_configured", "Configure the event trigger before recording an occurrence.");
            if (ret.getEventDeadlineMode() == null || ret.getEventDeadlineMode().isBlank())
                throw ApiException.conflict("trigger_not_configured", "Configure a deadline rule before recording an occurrence.");
            if (req.getTriggerDate() == null) throw ApiException.badRequest("triggerDate is required.");
            if (req.getTriggerDate().isAfter(LocalDate.now())) throw ApiException.badRequest("triggerDate cannot be in the future.");
            String reference = req.getReference() == null ? null : req.getReference().trim();
            if (reference != null && reference.length() > 2000) throw ApiException.badRequest("reference cannot exceed 2000 characters.");
            if ((reference == null || reference.isBlank()) && req.getEvidenceFileId() == null)
                throw ApiException.badRequest("Provide an evidence reference or attach an evidence file.");
            EvidenceFile file = null;
            if (req.getEvidenceFileId() != null) {
                if (req.getReference() != null && !req.getReference().isBlank())
                    throw ApiException.badRequest("Provide either a reference or an evidence file, not both.");
                file = evidence.findByFileIdAndSourceTypeAndSourceId(req.getEvidenceFileId(), "return_event", returnId)
                    .orElseThrow(() -> ApiException.badRequest("The evidence file must first be uploaded for this return event."));
                if (!Objects.equals(file.getUploadedByUserId(), userId))
                    throw ApiException.badRequest("The evidence file was not uploaded by the current user for this trigger.");
                reference = reference == null || reference.isBlank() ? file.getOriginalName() : reference;
            }
            if (file == null && (reference == null || reference.isBlank()))
                throw ApiException.badRequest("Provide a reference or attach an evidence file for this occurrence.");
            LocalDate baseDue;
            if ("MANUAL".equals(ret.getEventDeadlineMode())) {
                if (req.getDueDate() == null) throw ApiException.badRequest("dueDate is required from the request or directive.");
                if (req.getDueDate().isBefore(req.getTriggerDate())) throw ApiException.badRequest("dueDate cannot be before triggerDate.");
                baseDue = req.getDueDate();
            } else if ("OFFSET".equals(ret.getEventDeadlineMode())) {
                if (ret.getEventDeadlineDays() == null || ret.getEventDeadlineUnit() == null)
                    throw ApiException.conflict("invalid_trigger_configuration", "The event trigger deadline rule is incomplete.");
                baseDue = "WORKING".equals(ret.getEventDeadlineUnit())
                    ? workingDays.addWorkingDays(req.getTriggerDate(), ret.getEventDeadlineDays())
                    : workingDays.addCalendarDays(req.getTriggerDate(), ret.getEventDeadlineDays());
            } else {
                throw ApiException.conflict("invalid_trigger_configuration", "Configure the event trigger deadline rule first.");
            }
            LocalDate effectiveDue = "MANUAL".equals(ret.getEventDeadlineMode()) ? baseDue : workingDays.nextWorkingDay(baseDue);
            Integer prepDays = ret.getFilingDeadlineOffsetDays() != null ? ret.getFilingDeadlineOffsetDays() : 5;
            if (prepDays < 0 || prepDays > 365) throw ApiException.conflict("invalid_prep_days", "Return prep days must be between 0 and 365.");
            String period = "EVT" + UUID.randomUUID().toString().replace("-", "").substring(0, 17);
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("triggerLabel", ret.getEventTriggerLabel());
            event.put("deadlineMode", ret.getEventDeadlineMode());
            event.put("deadlineDays", ret.getEventDeadlineDays());
            event.put("deadlineUnit", ret.getEventDeadlineUnit());
            event.put("triggerDate", req.getTriggerDate().toString());
            event.put("reference", reference);
            event.put("unadjustedDueDate", baseDue.toString());
            event.put("dueDate", effectiveDue.toString());
            event.put("dueDateAdjusted", !baseDue.equals(effectiveDue));
            if (file != null) event.put("evidenceFile", file.getOriginalName());
            ReturnFilingInstance instance = instances.save(ReturnFilingInstance.builder()
                .returnId(returnId).period(period).triggerDate(req.getTriggerDate()).eventReference(reference)
                .eventEvidenceFileId(file == null ? null : file.getFileId())
                .unadjustedDueDate(baseDue).dueDate(effectiveDue).dueDateAdjusted(!baseDue.equals(effectiveDue))
                .prepStartDate(effectiveDue.minusDays(prepDays)).filingChannel(ret.getFilingChannel())
                .stageData(MAPPER.writeValueAsString(Map.of("trigger", event))).build());
            if (file != null) {
                EvidenceFile attached = file;
                attached.setSourceType("return_instance");
                attached.setSourceId(instance.getInstanceId());
                evidence.save(attached);
            }
            if (!instances.existsByReturnIdAndPeriod(returnId, period))
                throw new IllegalStateException("Return event period key was not persisted");
            audit.log(userId, "return_event_recorded", "return_instance", instance.getInstanceId(), null,
                Map.of("returnId", returnId, "triggerDate", req.getTriggerDate().toString(),
                    "baseDueDate", baseDue.toString(), "effectiveDueDate", effectiveDue.toString(),
                    "dueDateAdjusted", !baseDue.equals(effectiveDue)), file == null ? null : "evidence:" + file.getFileId());
            return ReturnEventFilingItem.from(instance);
    }

    @Transactional
    public ReturnEventFilingItem recordUploaded(Long returnId, RecordReturnEventRequest req, org.springframework.web.multipart.MultipartFile upload, Integer userId) {
        if (upload == null || upload.isEmpty()) throw ApiException.badRequest("Evidence file is required.");
        try {
            if (req == null || req.getTriggerDate() == null) throw ApiException.badRequest("Trigger date is required.");
            if (req.getReference() != null && !req.getReference().isBlank())
                throw ApiException.badRequest("Provide either a reference or an evidence file, not both.");
            EvidenceFile file = evidenceVault.upload(upload, "return_event", returnId,
                "Trigger evidence for " + req.getTriggerDate(), userId);
            req.setEvidenceFileId(file.getFileId());
            req.setReference(null);
            ReturnEventFilingItem result = doRecord(returnId, req, userId);
            evidence.findById(file.getFileId()).ifPresent(attached -> {
                attached.setSourceType("return_instance");
                attached.setSourceId(result.getInstanceId());
                evidence.save(attached);
            });
            return result;
        } catch (ApiException e) {
            throw e;
        } catch (Throwable e) {
            log.error("Failed to upload return event evidence: {}", e.getMessage(), e);
            throw new IllegalStateException("Failed to upload event evidence", e);
        }
    }

    @Transactional(readOnly = true)
    public List<ReturnEventFilingItem> list(Long returnId) {
        RegulatoryReturn ret = getEventReturn(returnId);
        return instances.findByReturnIdAndTriggerDateIsNotNullOrderByTriggerDateDescInstanceIdDesc(returnId)
            .stream().map(i -> {
                ReturnEventFilingItem item = ReturnEventFilingItem.from(i);
                item.setTriggerLabel(ret.getEventTriggerLabel());
                item.setTriggerType(ret.getEventTriggerLabel());
                item.setTriggerDate(i.getTriggerDate());
                item.setReference(i.getEventReference());
                item.setEvidenceFileId(i.getEventEvidenceFileId());
                item.setDueDate(i.getDueDate());
                item.setUnadjustedDueDate(i.getUnadjustedDueDate());
                item.setDueDateAdjusted(i.isDueDateAdjusted());
                item.setStatus(i.getStatus() == null ? null : i.getStatus().db());
                return item;
            }).toList();
    }

    private RegulatoryReturn getEventReturn(Long id) {
        RegulatoryReturn ret = returns.findById(id).orElseThrow(() -> ApiException.notFound("Return not found: " + id));
        ReturnFrequency frequency = ReturnFrequency.fromCode(ret.getFrequencyType()).orElse(ReturnFrequency.MONTHLY);
        if (frequency != ReturnFrequency.EVENT_DRIVEN) throw ApiException.conflict("not_event_driven", "Event triggers can only be configured for event-driven returns.");
            if (ret.getStatus() != RegulatoryReturnStatus.ACTIVE) throw ApiException.conflict("return_inactive", "Cannot record events for an inactive return.");
            if (ReturnFrequency.fromCode(ret.getFrequencyType()).orElse(ReturnFrequency.MONTHLY) != ReturnFrequency.EVENT_DRIVEN)
                throw ApiException.conflict("not_event_driven", "Event trigger configuration only applies to event-driven returns.");
            return ret;
    }
    private static String upper(String s) { return s == null ? null : s.trim().toUpperCase(Locale.ROOT); }
    private void rollback(Throwable e) {
        log.error("Return event operation failed: {}", e.getMessage(), e);
        try { em.clear(); } catch (Throwable ignored) {}
        try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
    }
    private static RuntimeException rethrow(Throwable e) { return e instanceof RuntimeException r ? r : new RuntimeException(e); }
}
