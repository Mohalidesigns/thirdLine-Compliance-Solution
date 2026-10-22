package com.atheris.compliance.tenant.backend.modules.tasks.service;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import com.atheris.compliance.tenant.backend.modules.escalation.repository.EscalationPolicyRepository;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskItemDto;
import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskStatsDto;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TaskCenterService {

    private static final String CATEGORY_RETURNS = "RETURNS";
    private static final Map<String, Integer> RANK =
        Map.of("OVERDUE", 0, "HIGH", 1, "MEDIUM", 2, "SOON", 3, "LOW", 4);

    private final ReturnFilingInstanceRepository instances;
    private final RegulatoryReturnRepository returns;
    private final EscalationPolicyRepository policies;
    private final EscalationPolicyService policyService;

    @Transactional(readOnly = true)
    public Page<TaskItemDto> page(String assignee, String category, String priority, String q,
                                  Integer ownerUserId, Integer currentUserId, Pageable pageable) {
        List<TaskItemDto> all = build(assignee, category, priority, q, ownerUserId, currentUserId);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), all.size());
        List<TaskItemDto> slice = start >= all.size() ? List.of() : all.subList(start, end);
        return new PageImpl<>(slice, pageable, all.size());
    }

    @Transactional(readOnly = true)
    public List<TaskItemDto> build(String assignee, String category, String priority, String q,
                                   Integer ownerUserId, Integer currentUserId) {
        boolean mine = !"all".equalsIgnoreCase(assignee == null || assignee.isBlank() ? "me" : assignee);
        return returnsTasks().stream()
            .filter(t -> !mine || (t.getOwnerUserId() != null && t.getOwnerUserId().equals(currentUserId)))
            .filter(t -> category == null || category.isBlank() || category.equalsIgnoreCase(t.getCategory()))
            .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase(t.getPriority()))
            .filter(t -> ownerUserId == null || ownerUserId.equals(t.getOwnerUserId()))
            .filter(t -> matches(t, q))
            .sorted(Comparator
                .comparingInt((TaskItemDto t) -> RANK.getOrDefault(t.getPriority(), 9))
                .thenComparing(TaskItemDto::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    @Transactional(readOnly = true)
    public TaskStatsDto stats(String assignee, Integer ownerUserId, Integer currentUserId) {
        List<TaskItemDto> all = build(assignee, null, null, null, ownerUserId, currentUserId);
        LocalDate today = LocalDate.now();
        long completed = instances.countByStatusInAndSubmittedDateGreaterThanEqual(
            List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE), today.minusDays(7));
        return TaskStatsDto.builder()
            .total(all.size())
            .overdue(all.stream().filter(t -> "OVERDUE".equals(t.getPriority())).count())
            .dueToday(all.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isEqual(today)).count())
            .dueThisWeek(all.stream().filter(t -> t.getDueDate() != null
                && !t.getDueDate().isBefore(today) && !t.getDueDate().isAfter(today.plusDays(7))).count())
            .unassigned(all.stream().filter(t -> t.getOwnerUserId() == null).count())
            .completedLast7d(completed)
            .byCategory(all.stream().collect(Collectors.groupingBy(TaskItemDto::getCategory, Collectors.counting())))
            .byPriority(all.stream().collect(Collectors.groupingBy(TaskItemDto::getPriority, Collectors.counting())))
            .build();
    }

    private List<TaskItemDto> returnsTasks() {
        LocalDate today = LocalDate.now();
        List<TaskItemDto> out = new ArrayList<>();

        List<ReturnFilingInstance> open = instances.findByStatusNotInAndDueDateBetweenOrderByDueDateAsc(
            List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE),
            today.minusDays(400), today.plusDays(120));
        Set<Long> ids = open.stream().map(ReturnFilingInstance::getReturnId).collect(Collectors.toSet());
        Map<Long, RegulatoryReturn> byId = new HashMap<>();
        if (!ids.isEmpty()) for (RegulatoryReturn r : returns.findAllById(ids)) byId.put(r.getReturnId(), r);

        for (ReturnFilingInstance i : open) {
            RegulatoryReturn r = byId.get(i.getReturnId());
            if (r == null || i.getDueDate() == null) continue;
            long days = ChronoUnit.DAYS.between(today, i.getDueDate());
            int lead = leadDays(r);
            ReturnStage stage = i.getCurrentStage();
            boolean escalated = i.getEscalationLevel() != null && i.getEscalationLevel() > 0;

            String type, priority, action, label;
            if (days < 0) {
                type = "RETURN_OVERDUE"; priority = "OVERDUE"; action = "OPEN"; label = "Open";
            } else if (stage == ReturnStage.SIGN_OFF) {
                type = "RETURN_SUBMIT_READY"; priority = "HIGH"; action = "SUBMIT"; label = "Submit";
            } else if (escalated) {
                type = "RETURN_ESCALATED"; priority = "HIGH"; action = "OPEN"; label = "Open";
            } else if (days <= lead) {
                if (stage == ReturnStage.NOT_STARTED) {
                    type = "RETURN_START_READY"; priority = "SOON"; action = "START"; label = "Start filing";
                } else {
                    type = "RETURN_DUE_SOON"; priority = "SOON"; action = "OPEN"; label = "Open";
                }
            } else {
                continue;
            }

            Integer ownerId = i.getStageOwnerUserId() != null ? i.getStageOwnerUserId() : r.getReturnOwnerUserId();
            out.add(TaskItemDto.builder()
                .id(i.getInstanceId()).key("return:" + i.getInstanceId())
                .type(type).category(CATEGORY_RETURNS)
                .title(r.getReturnName()).caption(caption(r, i))
                .priority(priority).dueDate(i.getDueDate()).daysRemaining((int) days)
                .ownerName(r.getReturnOwnerName()).ownerUserId(ownerId)
                .stage(stage == null ? null : stage.db()).escalationLevel(i.getEscalationLevel())
                .linkPath("/returns/" + r.getReturnId()).actionLabel(label).actionType(action)
                .sourceRef(Map.of("returnId", r.getReturnId(), "instanceId", i.getInstanceId()))
                .build());
        }

        for (RegulatoryReturn r : returns.findByStatus(RegulatoryReturnStatus.ACTIVE)) {
            if (!hasResponsiblePerson(r)) {
                out.add(returnGap(r, "person", "RETURN_NO_RESPONSIBLE_PERSON",
                    "No responsible person — filings are not generated", "Assign"));
            } else if (dueDateNeeded(r)) {
                out.add(returnGap(r, "duedate", "RETURN_DUE_DATE_NEEDED",
                    "Due date needed — set the schedule to generate filings", "Set due date"));
            }
        }
        return out;
    }

    private TaskItemDto returnGap(RegulatoryReturn r, String kind, String type, String caption, String label) {
        return TaskItemDto.builder()
            .id(-r.getReturnId()).key("return:" + r.getReturnId() + ":" + kind)
            .type(type).category(CATEGORY_RETURNS)
            .title(r.getReturnName()).caption(caption)
            .priority("MEDIUM").dueDate(null).daysRemaining(null)
            .ownerName(r.getReturnOwnerName()).ownerUserId(r.getReturnOwnerUserId())
            .linkPath("/returns").actionLabel(label).actionType("OPEN")
            .sourceRef(Map.of("returnId", r.getReturnId()))
            .build();
    }

    private int leadDays(RegulatoryReturn r) {
        EscalationPolicy pol = null;
        if (r.getEscalationPolicyId() != null) pol = policies.findById(r.getEscalationPolicyId()).orElse(null);
        if (pol == null) pol = policyService.defaultPolicy(EscalationConstants.SUBJECT_RETURN, r.getFrequencyType()).orElse(null);
        if (pol == null || pol.getReminderStartValue() == null) return 30;
        return EscalationConstants.UNIT_HOURS.equalsIgnoreCase(
                pol.getReminderStartUnit() == null ? "" : pol.getReminderStartUnit())
            ? (int) Math.ceil(pol.getReminderStartValue() / 24.0) : pol.getReminderStartValue();
    }

    private static boolean hasResponsiblePerson(RegulatoryReturn r) {
        return (r.getResponsiblePersons() != null && !r.getResponsiblePersons().isEmpty())
            || (r.getResponsiblePerson() != null && !r.getResponsiblePerson().isBlank());
    }

    private static boolean dueDateNeeded(RegulatoryReturn r) {
        String ft = r.getFrequencyType();
        if (ft == null) return false;
        if (ft.equals("DAILY") || ft.equals("WEEKLY") || ft.equals("EVENT_DRIVEN")) return false;
        return r.getFilingDate() == null && r.getDueDaysAfterPeriodEnd() == null;
    }

    private static String caption(RegulatoryReturn r, ReturnFilingInstance i) {
        StringBuilder sb = new StringBuilder();
        if (r.getFilingRegulator() != null && !r.getFilingRegulator().isBlank()) sb.append(r.getFilingRegulator());
        if (i.getPeriod() != null) sb.append(sb.length() > 0 ? " · " : "").append(i.getPeriod());
        if (r.getResponsiblePerson() != null && !r.getResponsiblePerson().isBlank())
            sb.append(sb.length() > 0 ? " · " : "").append("Resp: ").append(r.getResponsiblePerson());
        return sb.toString();
    }

    private static boolean matches(TaskItemDto t, String q) {
        if (q == null || q.isBlank()) return true;
        String s = q.toLowerCase(Locale.ROOT);
        return (t.getTitle() != null && t.getTitle().toLowerCase(Locale.ROOT).contains(s))
            || (t.getCaption() != null && t.getCaption().toLowerCase(Locale.ROOT).contains(s))
            || (t.getOwnerName() != null && t.getOwnerName().toLowerCase(Locale.ROOT).contains(s));
    }
}
