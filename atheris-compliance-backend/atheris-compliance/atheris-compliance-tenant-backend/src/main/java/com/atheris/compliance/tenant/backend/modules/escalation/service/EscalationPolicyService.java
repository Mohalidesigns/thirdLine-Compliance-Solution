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
        return list(subjectType, false);
    }

    public List<EscalationPolicyDto> list(String subjectType, boolean defaultsOnly) {
        String scope = subjectType == null || subjectType.isBlank() ? null : subjectType.toUpperCase(Locale.ROOT);
        List<EscalationPolicy> list = defaultsOnly
            ? policies.findByIsDefaultTrueOrderBySubjectTypeAscNameAsc()
            : (scope == null ? policies.findAllByOrderBySubjectTypeAscNameAsc()
                             : policies.findBySubjectTypeOrderByNameAsc(scope));
        return list.stream()
            .filter(p -> scope == null || scope.equalsIgnoreCase(p.getSubjectType()))
            .map(this::toDto).toList();
    }

    public EscalationPolicyDto get(Long id) {
        return toDto(load(id));
    }

    @Transactional
    public EscalationPolicyDto create(EscalationPolicyRequest req, Integer userId) {
        try {
            String subjectType = validate(req);
            if (Boolean.TRUE.equals(req.getIsDefault())) clearDefaults(subjectType, req.getFrequencyScope(), null);
            EscalationPolicy policy = EscalationPolicy.builder()
                .name(req.getName().trim())
                .subjectType(subjectType)
                .frequencyScope(normScope(req.getFrequencyScope()))
                .isDefault(Boolean.TRUE.equals(req.getIsDefault()))
                .isActive(req.getIsActive() == null || req.getIsActive())
                .reminderStartValue(req.getReminderStartValue())
                .reminderStartUnit(normUnit(req.getReminderStartUnit()))
                .reminderRepeatValue(req.getReminderRepeatValue())
                .reminderRepeatUnit(normUnit(req.getReminderRepeatUnit()))
                .sendLink(req.getSendLink() == null || req.getSendLink())
                .notifyOnStart(Boolean.TRUE.equals(req.getNotifyOnStart()))
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
            if (Boolean.TRUE.equals(req.getIsDefault())) clearDefaults(subjectType, req.getFrequencyScope(), id);
            policy.setIsDefault(Boolean.TRUE.equals(req.getIsDefault()));
            policy.setFrequencyScope(normScope(req.getFrequencyScope()));
            policy.setIsActive(req.getIsActive() == null || req.getIsActive());
            policy.setReminderStartValue(req.getReminderStartValue());
            policy.setReminderStartUnit(normUnit(req.getReminderStartUnit()));
            policy.setReminderRepeatValue(req.getReminderRepeatValue());
            policy.setReminderRepeatUnit(normUnit(req.getReminderRepeatUnit()));
            policy.setSendLink(req.getSendLink() == null || req.getSendLink());
            policy.setNotifyOnStart(Boolean.TRUE.equals(req.getNotifyOnStart()));
            policy = policies.save(policy);
            policyLevels.deleteByPolicyId(id);
            policyLevels.flush();
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
            policyLevels.flush();
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
        ensureFrozen(subjectType, subjectId, subjectPolicyId, null);
    }

    public void ensureFrozen(String subjectType, Long subjectId, Long subjectPolicyId, String frequencyScope) {
        try {
            if (instances.findBySubjectTypeAndSubjectId(subjectType, subjectId).isPresent()) return;
            EscalationPolicy policy = null;
            if (subjectPolicyId != null) policy = policies.findById(subjectPolicyId).orElse(null);
            if (policy == null) policy = defaultPolicy(subjectType, frequencyScope).orElse(null);
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
            instanceLevels.flush();
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
                instanceLevels.flush();
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
            instanceLevels.flush();
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

    @Transactional
    public int refreshUntouchedFrozen(String subjectType, List<Long> subjectIds, Long policyId) {
        EscalationPolicy target = load(policyId);
        int changed = 0;
        for (Long subjectId : subjectIds == null ? List.<Long>of() : subjectIds) {
            EscalationInstance row = instances.findBySubjectTypeAndSubjectId(subjectType, subjectId).orElse(null);
            if (row == null || !matchesSource(row)) continue;
            freezeFromPolicy(subjectType, subjectId, target.getPolicyId(), null);
            changed++;
        }
        if (changed > 0) {
            log.info("[Escalation] re-pinned {} {} filing(s) to policy {}",
                changed, subjectType, target.getPolicyId());
        }
        return changed;
    }

    private boolean matchesSource(EscalationInstance row) {
        if (row.getSourcePolicyId() == null) return false;
        EscalationPolicy source = policies.findById(row.getSourcePolicyId()).orElse(null);
        if (source == null) return false;
        if (!Objects.equals(row.getReminderStartValue(), source.getReminderStartValue())
            || !Objects.equals(normUnit(row.getReminderStartUnit()), normUnit(source.getReminderStartUnit()))
            || !Objects.equals(row.getReminderRepeatValue(), source.getReminderRepeatValue())
            || !Objects.equals(normUnit(row.getReminderRepeatUnit()), normUnit(source.getReminderRepeatUnit())))
            return false;
        List<EscalationInstanceLevel> rowLevels = instanceLevels.findByOverrideIdOrderByLevelNoAsc(row.getOverrideId());
        List<EscalationPolicyLevel> sourceLevels = policyLevels.findByPolicyIdOrderByLevelNoAsc(source.getPolicyId());
        if (rowLevels.size() != sourceLevels.size()) return false;
        for (int i = 0; i < rowLevels.size(); i++) {
            EscalationInstanceLevel a = rowLevels.get(i);
            EscalationPolicyLevel b = sourceLevels.get(i);
            if (!Objects.equals(a.getLevelNo(), b.getLevelNo())
                || !Objects.equals(a.getAfterValue(), b.getAfterValue())
                || !Objects.equals(normUnit(a.getAfterUnit()), normUnit(b.getAfterUnit()))
                || !Objects.equals(a.getTargetType(), b.getTargetType())
                || !Objects.equals(a.getTargetRole(), b.getTargetRole())
                || !Objects.equals(a.getTargetUserId(), b.getTargetUserId())
                || !Objects.equals(a.getTargetName(), b.getTargetName())
                || !Objects.equals(a.getTargetEmail(), b.getTargetEmail()))
                return false;
        }
        return true;
    }

    public EscalationInstanceDto resolve(String subjectType, Long subjectId, Long subjectPolicyId) {
        return resolve(subjectType, subjectId, subjectPolicyId, null);
    }

    public EscalationInstanceDto resolve(String subjectType, Long subjectId, Long subjectPolicyId, String frequencyScope) {
        Optional<EscalationInstance> override = instances.findBySubjectTypeAndSubjectId(subjectType, subjectId);
        if (override.isPresent()) return toInstanceDto(override.get());
        EscalationPolicy policy = null;
        if (subjectPolicyId != null) policy = policies.findById(subjectPolicyId).orElse(null);
        if (policy == null) policy = defaultPolicy(subjectType, frequencyScope).orElse(null);
        return policy == null ? null : fromPolicy(policy);
    }

    public Optional<EscalationPolicy> defaultPolicy(String subjectType) {
        return defaultPolicy(subjectType, null);
    }

    public boolean hasDefaultExact(String subjectType, String frequencyScope) {
        String scope = normScope(frequencyScope);
        return policies.findBySubjectTypeOrderByNameAsc(subjectType).stream()
            .anyMatch(p -> Boolean.TRUE.equals(p.getIsDefault())
                && Objects.equals(normScope(p.getFrequencyScope()), scope));
    }

    @Transactional
    public void refreshSeededDefault(String subjectType, String frequencyScope, Integer legacyStart, Integer legacyRepeat,
                                     Integer start, String startUnit, Integer repeat, String repeatUnit) {
        policies.findBySubjectTypeOrderByNameAsc(subjectType).stream()
            .filter(p -> Boolean.TRUE.equals(p.getIsDefault()))
            .filter(p -> Objects.equals(normScope(p.getFrequencyScope()), normScope(frequencyScope)))
            .forEach(p -> {
                boolean windowUnedited = Objects.equals(p.getReminderStartValue(), legacyStart)
                    && Objects.equals(normUnit(p.getReminderStartUnit()), EscalationConstants.UNIT_DAYS)
                    && Objects.equals(p.getReminderRepeatValue(), legacyRepeat)
                    && Objects.equals(normUnit(p.getReminderRepeatUnit()), EscalationConstants.UNIT_DAYS);
                boolean notifyUnedited = !Boolean.TRUE.equals(p.getNotifyOnStart());
                if (!windowUnedited && !notifyUnedited) return;
                if (windowUnedited) {
                    p.setReminderStartValue(start);
                    p.setReminderStartUnit(normUnit(startUnit));
                    p.setReminderRepeatValue(repeat);
                    p.setReminderRepeatUnit(normUnit(repeatUnit));
                }
                p.setNotifyOnStart(true);
                policies.save(p);
                log.info("[Escalation] refreshed default {}{} (window={}, notifyOnStart=true)",
                    subjectType, normScope(frequencyScope) == null ? "" : " " + normScope(frequencyScope), windowUnedited);
            });
    }

    public Optional<EscalationPolicy> defaultPolicy(String subjectType, String frequencyScope) {
        String scope = normScope(frequencyScope);
        List<EscalationPolicy> actives = policies.findBySubjectTypeOrderByNameAsc(subjectType).stream()
            .filter(p -> Boolean.TRUE.equals(p.getIsDefault()) && !Boolean.FALSE.equals(p.getIsActive()))
            .toList();
        if (scope != null) {
            Optional<EscalationPolicy> match = actives.stream()
                .filter(p -> scope.equals(normScope(p.getFrequencyScope()))).findFirst();
            if (match.isPresent()) return match;
        }
        return actives.stream().filter(p -> normScope(p.getFrequencyScope()) == null).findFirst();
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
        if (req.getReminderStartValue() != null && req.getReminderStartValue() < 0)
            throw ApiException.badRequest("invalid_reminder_start", "Remind before cannot be negative");
        if (req.getReminderRepeatValue() != null && req.getReminderRepeatValue() < 0)
            throw ApiException.badRequest("invalid_reminder_repeat", "Remind after every cannot be negative");
        List<EscalationLevelRequest> levels = req.getLevels() == null ? List.of() : req.getLevels();
        for (EscalationLevelRequest l : levels) {
            if (l.getLevelNo() == null || l.getLevelNo() < 1 || l.getLevelNo() > EscalationConstants.MAX_LEVEL)
                throw ApiException.badRequest("invalid_level", "levelNo must be between 1 and " + EscalationConstants.MAX_LEVEL);
            if (l.getTargetType() == null || l.getTargetType().isBlank())
                throw ApiException.badRequest("invalid_target", "targetType is required for level " + l.getLevelNo());
            if (l.getAfterValue() != null && l.getAfterValue() < 0)
                throw ApiException.badRequest("invalid_level_offset", "The wait after the due date cannot be negative");
        }
        return subjectType;
    }

    private void clearDefaults(String subjectType, String frequencyScope, Long exceptId) {
        String scope = normScope(frequencyScope);
        for (EscalationPolicy p : policies.findBySubjectTypeOrderByNameAsc(subjectType)) {
            if (!Boolean.TRUE.equals(p.getIsDefault())) continue;
            if (!Objects.equals(normScope(p.getFrequencyScope()), scope)) continue;
            if (exceptId != null && exceptId.equals(p.getPolicyId())) continue;
            p.setIsDefault(false);
            policies.save(p);
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
            .notifyOnStart(p.getNotifyOnStart())
            .frequencyScope(p.getFrequencyScope())
            .levels(policyLevels.findByPolicyIdOrderByLevelNoAsc(p.getPolicyId()).stream().map(this::toLevelDto).toList())
            .createdAt(p.getCreatedAt()).updatedAt(p.getUpdatedAt())
            .build();
    }

    private EscalationInstanceDto toInstanceDto(EscalationInstance i) {
        EscalationPolicy source = i.getSourcePolicyId() == null ? null
            : policies.findById(i.getSourcePolicyId()).orElse(null);
        return EscalationInstanceDto.builder()
            .overrideId(i.getOverrideId()).subjectType(i.getSubjectType()).subjectId(i.getSubjectId())
            .sourcePolicyId(i.getSourcePolicyId())
            .reminderStartValue(i.getReminderStartValue()).reminderStartUnit(i.getReminderStartUnit())
            .reminderRepeatValue(i.getReminderRepeatValue()).reminderRepeatUnit(i.getReminderRepeatUnit())
            .sendLink(i.getSendLink()).active(i.getActive())
            .notifyOnStart(source == null ? null : source.getNotifyOnStart())
            .levels(instanceLevels.findByOverrideIdOrderByLevelNoAsc(i.getOverrideId()).stream().map(this::toLevelDto).toList())
            .build();
    }

    private EscalationInstanceDto fromPolicy(EscalationPolicy p) {
        return EscalationInstanceDto.builder()
            .overrideId(null).subjectType(p.getSubjectType()).subjectId(null).sourcePolicyId(p.getPolicyId())
            .reminderStartValue(p.getReminderStartValue()).reminderStartUnit(p.getReminderStartUnit())
            .reminderRepeatValue(p.getReminderRepeatValue()).reminderRepeatUnit(p.getReminderRepeatUnit())
            .sendLink(p.getSendLink()).active(p.getIsActive())
            .notifyOnStart(p.getNotifyOnStart())
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

    private static String normScope(String scope) {
        if (scope == null || scope.isBlank()) return null;
        return scope.trim().toUpperCase(Locale.ROOT);
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
