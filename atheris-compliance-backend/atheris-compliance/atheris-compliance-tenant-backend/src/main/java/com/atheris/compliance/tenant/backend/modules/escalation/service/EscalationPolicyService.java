package com.atheris.compliance.tenant.backend.modules.escalation.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.*;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.*;
import com.atheris.compliance.tenant.backend.modules.escalation.repository.*;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class EscalationPolicyService {

    private final EscalationPolicyRepository policies;
    private final EscalationPolicyLevelRepository policyLevels;
    private final EscalationInstanceRepository instances;
    private final EscalationInstanceLevelRepository instanceLevels;
    private final AuditService audit;

    @PersistenceContext
    private EntityManager em;

    public List<EscalationPolicyDto> list(String subjectType) {
        List<EscalationPolicy> list = subjectType == null || subjectType.isBlank()
            ? policies.findAllByOrderBySubjectTypeAscNameAsc()
            : policies.findBySubjectTypeOrderByNameAsc(subjectType.toUpperCase(Locale.ROOT));
        return list.stream().map(this::toDto).toList();
    }

    public EscalationPolicyDto get(Long id) {
        return toDto(load(id));
    }

    @Transactional
    public EscalationPolicyDto create(EscalationPolicyRequest req, Integer userId) {
        try {
            String subjectType = validate(req);
            if (Boolean.TRUE.equals(req.getIsDefault())) clearDefaults(subjectType);
            EscalationPolicy policy = EscalationPolicy.builder()
                .name(req.getName().trim())
                .subjectType(subjectType)
                .isDefault(Boolean.TRUE.equals(req.getIsDefault()))
                .isActive(req.getIsActive() == null || req.getIsActive())
                .reminderStartValue(req.getReminderStartValue())
                .reminderStartUnit(normUnit(req.getReminderStartUnit()))
                .reminderRepeatValue(req.getReminderRepeatValue())
                .reminderRepeatUnit(normUnit(req.getReminderRepeatUnit()))
                .sendLink(req.getSendLink() == null || req.getSendLink())
                .createdByUserId(userId)
                .build();
            policy = policies.save(policy);
            writePolicyLevels(policy.getPolicyId(), req.getLevels());
            audit.log(userId, "escalation_policy_created", "escalation_policy", policy.getPolicyId(),
                Map.of("name", policy.getName(), "subjectType", subjectType));
            return toDto(policy);
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public EscalationPolicyDto update(Long id, EscalationPolicyRequest req, Integer userId) {
        try {
            EscalationPolicy policy = load(id);
            String subjectType = validate(req);
            policy.setName(req.getName().trim());
            policy.setSubjectType(subjectType);
            if (Boolean.TRUE.equals(req.getIsDefault())) clearDefaults(subjectType, id);
            policy.setIsDefault(Boolean.TRUE.equals(req.getIsDefault()));
            policy.setIsActive(req.getIsActive() == null || req.getIsActive());
            policy.setReminderStartValue(req.getReminderStartValue());
            policy.setReminderStartUnit(normUnit(req.getReminderStartUnit()));
            policy.setReminderRepeatValue(req.getReminderRepeatValue());
            policy.setReminderRepeatUnit(normUnit(req.getReminderRepeatUnit()));
            policy.setSendLink(req.getSendLink() == null || req.getSendLink());
            policy = policies.save(policy);
            policyLevels.deleteByPolicyId(id);
            writePolicyLevels(id, req.getLevels());
            audit.log(userId, "escalation_policy_updated", "escalation_policy", id,
                Map.of("name", policy.getName()));
            return toDto(policy);
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public void delete(Long id, Integer userId) {
        try {
            EscalationPolicy policy = load(id);
            if (Boolean.TRUE.equals(policy.getIsDefault()))
                throw ApiException.conflict("default_policy", "The default policy cannot be deleted; pick another default first.");
            policyLevels.deleteByPolicyId(id);
            policies.delete(policy);
            audit.log(userId, "escalation_policy_deleted", "escalation_policy", id,
                Map.of("name", policy.getName()));
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    public EscalationInstanceDto getInstance(String subjectType, Long subjectId) {
        return instances.findBySubjectTypeAndSubjectId(subjectType, subjectId)
            .map(this::toInstanceDto).orElse(null);
    }

    @Transactional
    public void ensureFrozen(String subjectType, Long subjectId, Long subjectPolicyId) {
        try {
            if (instances.findBySubjectTypeAndSubjectId(subjectType, subjectId).isPresent()) return;
            EscalationPolicy policy = null;
            if (subjectPolicyId != null) policy = policies.findById(subjectPolicyId).orElse(null);
            if (policy == null) policy = defaultPolicy(subjectType).orElse(null);
            if (policy == null) return;
            EscalationInstance instance = instances.save(EscalationInstance.builder()
                .subjectType(subjectType).subjectId(subjectId).sourcePolicyId(policy.getPolicyId())
                .reminderStartValue(policy.getReminderStartValue()).reminderStartUnit(policy.getReminderStartUnit())
                .reminderRepeatValue(policy.getReminderRepeatValue()).reminderRepeatUnit(policy.getReminderRepeatUnit())
                .sendLink(policy.getSendLink()).active(true).build());
            for (EscalationPolicyLevel l : policyLevels.findByPolicyIdOrderByLevelNoAsc(policy.getPolicyId())) {
                instanceLevels.save(EscalationInstanceLevel.builder()
                    .overrideId(instance.getOverrideId()).levelNo(l.getLevelNo())
                    .afterValue(l.getAfterValue()).afterUnit(l.getAfterUnit())
                    .targetType(l.getTargetType()).targetRole(l.getTargetRole())
                    .targetUserId(l.getTargetUserId()).targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
                    .build());
            }
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public EscalationInstanceDto saveInstance(String subjectType, Long subjectId, EscalationInstanceRequest req, Integer userId) {
        try {
            EscalationInstance instance = instances.findBySubjectTypeAndSubjectId(subjectType, subjectId)
                .orElseGet(() -> EscalationInstance.builder().subjectType(subjectType).subjectId(subjectId).build());
            instance.setReminderStartValue(req.getReminderStartValue());
            instance.setReminderStartUnit(normUnit(req.getReminderStartUnit()));
            instance.setReminderRepeatValue(req.getReminderRepeatValue());
            instance.setReminderRepeatUnit(normUnit(req.getReminderRepeatUnit()));
            instance.setSendLink(req.getSendLink() == null || req.getSendLink());
            instance.setActive(req.getActive() == null || req.getActive());
            instance = instances.save(instance);
            instanceLevels.deleteByOverrideId(instance.getOverrideId());
            writeInstanceLevels(instance.getOverrideId(), req.getLevels());
            audit.log(userId, "escalation_instance_updated", subjectType.toLowerCase(Locale.ROOT), subjectId,
                Map.of("overrideId", instance.getOverrideId()));
            return toInstanceDto(instance);
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public void deleteInstance(String subjectType, Long subjectId, Integer userId) {
        try {
            instances.findBySubjectTypeAndSubjectId(subjectType, subjectId).ifPresent(instance -> {
                instanceLevels.deleteByOverrideId(instance.getOverrideId());
                instances.delete(instance);
                audit.log(userId, "escalation_instance_deleted", subjectType.toLowerCase(Locale.ROOT), subjectId, Map.of());
            });
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    @Transactional
    public EscalationInstanceDto freezeFromPolicy(String subjectType, Long subjectId, Long policyId, Integer userId) {
        try {
            EscalationPolicy policy = load(policyId);
            EscalationInstance instance = instances.findBySubjectTypeAndSubjectId(subjectType, subjectId)
                .orElseGet(() -> EscalationInstance.builder().subjectType(subjectType).subjectId(subjectId).build());
            instance.setSourcePolicyId(policy.getPolicyId());
            instance.setReminderStartValue(policy.getReminderStartValue());
            instance.setReminderStartUnit(policy.getReminderStartUnit());
            instance.setReminderRepeatValue(policy.getReminderRepeatValue());
            instance.setReminderRepeatUnit(policy.getReminderRepeatUnit());
            instance.setSendLink(policy.getSendLink());
            instance.setActive(true);
            instance = instances.save(instance);
            instanceLevels.deleteByOverrideId(instance.getOverrideId());
            for (EscalationPolicyLevel l : policyLevels.findByPolicyIdOrderByLevelNoAsc(policy.getPolicyId())) {
                instanceLevels.save(EscalationInstanceLevel.builder()
                    .overrideId(instance.getOverrideId()).levelNo(l.getLevelNo())
                    .afterValue(l.getAfterValue()).afterUnit(l.getAfterUnit())
                    .targetType(l.getTargetType()).targetRole(l.getTargetRole())
                    .targetUserId(l.getTargetUserId()).targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
                    .build());
            }
            return toInstanceDto(instance);
        } catch (Throwable e) {
            rollback();
            throw rethrow(e);
        }
    }

    public EscalationInstanceDto resolve(String subjectType, Long subjectId, Long subjectPolicyId) {
        Optional<EscalationInstance> override = instances.findBySubjectTypeAndSubjectId(subjectType, subjectId);
        if (override.isPresent()) return toInstanceDto(override.get());
        EscalationPolicy policy = null;
        if (subjectPolicyId != null) policy = policies.findById(subjectPolicyId).orElse(null);
        if (policy == null) policy = defaultPolicy(subjectType).orElse(null);
        return policy == null ? null : fromPolicy(policy);
    }

    public Optional<EscalationPolicy> defaultPolicy(String subjectType) {
        return policies.findBySubjectTypeOrderByNameAsc(subjectType).stream()
            .filter(p -> Boolean.TRUE.equals(p.getIsDefault()) && !Boolean.FALSE.equals(p.getIsActive()))
            .findFirst();
    }

    private EscalationPolicy load(Long id) {
        return policies.findById(id).orElseThrow(() -> ApiException.notFound("Escalation policy not found: " + id));
    }

    private String validate(EscalationPolicyRequest req) {
        if (req == null || req.getName() == null || req.getName().isBlank())
            throw ApiException.badRequest("invalid_policy", "Policy name is required");
        String subjectType = req.getSubjectType() == null ? "" : req.getSubjectType().trim().toUpperCase(Locale.ROOT);
        if (!EscalationConstants.SUBJECT_RETURN.equals(subjectType) && !EscalationConstants.SUBJECT_CONTROL.equals(subjectType))
            throw ApiException.badRequest("invalid_subject_type", "subjectType must be RETURN or CONTROL");
        List<EscalationLevelRequest> levels = req.getLevels() == null ? List.of() : req.getLevels();
        for (EscalationLevelRequest l : levels) {
            if (l.getLevelNo() == null || l.getLevelNo() < 1 || l.getLevelNo() > EscalationConstants.MAX_LEVEL)
                throw ApiException.badRequest("invalid_level", "levelNo must be between 1 and " + EscalationConstants.MAX_LEVEL);
            if (l.getTargetType() == null || l.getTargetType().isBlank())
                throw ApiException.badRequest("invalid_target", "targetType is required for level " + l.getLevelNo());
        }
        return subjectType;
    }

    private void clearDefaults(String subjectType) { clearDefaults(subjectType, null); }

    private void clearDefaults(String subjectType, Long exceptId) {
        for (EscalationPolicy p : policies.findBySubjectTypeOrderByNameAsc(subjectType)) {
            if (Boolean.TRUE.equals(p.getIsDefault()) && (exceptId == null || !exceptId.equals(p.getPolicyId()))) {
                p.setIsDefault(false);
                policies.save(p);
            }
        }
    }

    private void writePolicyLevels(Long policyId, List<EscalationLevelRequest> levels) {
        for (EscalationLevelRequest l : levels == null ? List.<EscalationLevelRequest>of() : levels) {
            policyLevels.save(EscalationPolicyLevel.builder()
                .policyId(policyId).levelNo(l.getLevelNo())
                .afterValue(l.getAfterValue() == null ? 0 : l.getAfterValue())
                .afterUnit(normUnit(l.getAfterUnit()))
                .targetType(l.getTargetType().toUpperCase(Locale.ROOT))
                .targetRole(l.getTargetRole()).targetUserId(l.getTargetUserId())
                .targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
                .build());
        }
    }

    private void writeInstanceLevels(Long overrideId, List<EscalationLevelRequest> levels) {
        for (EscalationLevelRequest l : levels == null ? List.<EscalationLevelRequest>of() : levels) {
            instanceLevels.save(EscalationInstanceLevel.builder()
                .overrideId(overrideId).levelNo(l.getLevelNo())
                .afterValue(l.getAfterValue() == null ? 0 : l.getAfterValue())
                .afterUnit(normUnit(l.getAfterUnit()))
                .targetType(l.getTargetType().toUpperCase(Locale.ROOT))
                .targetRole(l.getTargetRole()).targetUserId(l.getTargetUserId())
                .targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
                .build());
        }
    }

    private EscalationPolicyDto toDto(EscalationPolicy p) {
        return EscalationPolicyDto.builder()
            .policyId(p.getPolicyId()).name(p.getName()).subjectType(p.getSubjectType())
            .isDefault(p.getIsDefault()).isActive(p.getIsActive())
            .reminderStartValue(p.getReminderStartValue()).reminderStartUnit(p.getReminderStartUnit())
            .reminderRepeatValue(p.getReminderRepeatValue()).reminderRepeatUnit(p.getReminderRepeatUnit())
            .sendLink(p.getSendLink())
            .levels(policyLevels.findByPolicyIdOrderByLevelNoAsc(p.getPolicyId()).stream().map(this::toLevelDto).toList())
            .createdAt(p.getCreatedAt()).updatedAt(p.getUpdatedAt())
            .build();
    }

    private EscalationInstanceDto toInstanceDto(EscalationInstance i) {
        return EscalationInstanceDto.builder()
            .overrideId(i.getOverrideId()).subjectType(i.getSubjectType()).subjectId(i.getSubjectId())
            .sourcePolicyId(i.getSourcePolicyId())
            .reminderStartValue(i.getReminderStartValue()).reminderStartUnit(i.getReminderStartUnit())
            .reminderRepeatValue(i.getReminderRepeatValue()).reminderRepeatUnit(i.getReminderRepeatUnit())
            .sendLink(i.getSendLink()).active(i.getActive())
            .levels(instanceLevels.findByOverrideIdOrderByLevelNoAsc(i.getOverrideId()).stream().map(this::toLevelDto).toList())
            .build();
    }

    private EscalationInstanceDto fromPolicy(EscalationPolicy p) {
        return EscalationInstanceDto.builder()
            .overrideId(null).subjectType(p.getSubjectType()).subjectId(null).sourcePolicyId(p.getPolicyId())
            .reminderStartValue(p.getReminderStartValue()).reminderStartUnit(p.getReminderStartUnit())
            .reminderRepeatValue(p.getReminderRepeatValue()).reminderRepeatUnit(p.getReminderRepeatUnit())
            .sendLink(p.getSendLink()).active(p.getIsActive())
            .levels(policyLevels.findByPolicyIdOrderByLevelNoAsc(p.getPolicyId()).stream().map(this::toLevelDto).toList())
            .build();
    }

    private EscalationLevelDto toLevelDto(EscalationPolicyLevel l) {
        return EscalationLevelDto.builder()
            .levelId(l.getLevelId()).levelNo(l.getLevelNo())
            .afterValue(l.getAfterValue()).afterUnit(l.getAfterUnit())
            .targetType(l.getTargetType()).targetRole(l.getTargetRole()).targetUserId(l.getTargetUserId())
            .targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
            .build();
    }

    private EscalationLevelDto toLevelDto(EscalationInstanceLevel l) {
        return EscalationLevelDto.builder()
            .levelId(l.getLevelId()).levelNo(l.getLevelNo())
            .afterValue(l.getAfterValue()).afterUnit(l.getAfterUnit())
            .targetType(l.getTargetType()).targetRole(l.getTargetRole()).targetUserId(l.getTargetUserId())
            .targetName(l.getTargetName()).targetEmail(l.getTargetEmail())
            .build();
    }

    private static String normUnit(String unit) {
        if (unit == null || unit.isBlank()) return null;
        String u = unit.trim().toUpperCase(Locale.ROOT);
        return EscalationConstants.UNIT_HOURS.equals(u) ? EscalationConstants.UNIT_HOURS : EscalationConstants.UNIT_DAYS;
    }

    private void rollback() {
        try { em.clear(); } catch (Throwable ignored) {}
        try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
    }

    private static RuntimeException rethrow(Throwable e) {
        return e instanceof RuntimeException r ? r : new RuntimeException(e);
    }
}
