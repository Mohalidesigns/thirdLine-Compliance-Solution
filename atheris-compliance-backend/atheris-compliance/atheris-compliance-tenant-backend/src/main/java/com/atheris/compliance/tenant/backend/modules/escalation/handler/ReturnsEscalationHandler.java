package com.atheris.compliance.tenant.backend.modules.escalation.handler;

import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationCandidate;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationSubjectHandler;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.Person;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Component
@Slf4j
@RequiredArgsConstructor
public class ReturnsEscalationHandler implements EscalationSubjectHandler {

    private final ReturnFilingInstanceRepository instances;
    private final RegulatoryReturnRepository returns;
    private final UserRepository users;
    private final OwnerRepository owners;

    @Override
    public String subjectType() {
        return EscalationConstants.SUBJECT_RETURN;
    }

    @Override
    @Transactional(readOnly = true)
    public List<EscalationCandidate> findCandidates(LocalDate today) {
        LocalDate from = today.minusDays(150);
        LocalDate to = today.plusDays(150);
        List<ReturnFilingInstance> found = instances.findByStatusNotInAndDueDateBetweenOrderByDueDateAsc(
            List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE), from, to);
        if (found.isEmpty()) return List.of();

        Set<Long> returnIds = found.stream().map(ReturnFilingInstance::getReturnId).collect(Collectors.toSet());
        Map<Long, RegulatoryReturn> byId = returns.findAllById(returnIds).stream()
            .filter(r -> r.getStatus() == RegulatoryReturnStatus.ACTIVE)
            .collect(Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));
        if (byId.isEmpty()) return List.of();

        Map<String, Person> directory = directory();
        List<EscalationCandidate> out = new ArrayList<>();
        for (ReturnFilingInstance instance : found) {
            RegulatoryReturn r = byId.get(instance.getReturnId());
            if (r == null || instance.getDueDate() == null) continue;
            Map<String, String> extra = new HashMap<>();
            extra.put("period", instance.getPeriod() == null ? "" : instance.getPeriod());
            extra.put("regulator", r.getFilingRegulator() == null ? "" : r.getFilingRegulator());
            extra.put("actName", r.getActName() == null ? "" : r.getActName());
            out.add(new EscalationCandidate(
                EscalationConstants.SUBJECT_RETURN,
                instance.getInstanceId(),
                r.getReturnName(),
                r.getEscalationPolicyId(),
                assignees(r, directory),
                owner(r),
                instance.getDueDate().atStartOfDay(),
                instance.getPrepStartDate() == null ? null : instance.getPrepStartDate().atStartOfDay(),
                r.getReturnId(),
                "/returns/",
                NotificationConstants.CATEGORY_RETURNS,
                extra));
        }
        return out;
    }

    @Override
    @Transactional
    public void markEscalated(Long subjectId, int level) {
        instances.findById(subjectId).ifPresent(instance -> {
            instance.setEscalationLevel(level);
            instance.setEscalatedAt(Instant.now());
            instances.save(instance);
        });
    }

    private List<Person> assignees(RegulatoryReturn r, Map<String, Person> directory) {
        List<Person> out = new ArrayList<>();
        for (String name : r.getResponsiblePersons() == null ? List.<String>of() : r.getResponsiblePersons()) {
            if (name == null || name.isBlank()) continue;
            Person person = directory.get(name.trim().toLowerCase(Locale.ROOT));
            if (person != null) out.add(person);
            else if (name.contains("@")) out.add(new Person(null, name.trim(), null));
        }
        Person owner = owner(r);
        if (owner != null && owner.hasEmail()
            && out.stream().noneMatch(p -> owner.email().equalsIgnoreCase(p.email()))) {
            out.add(owner);
        }
        return out;
    }

    private Person owner(RegulatoryReturn r) {
        if (r.getReturnOwnerUserId() != null) {
            User u = users.findById(r.getReturnOwnerUserId()).orElse(null);
            if (u != null) return new Person(u.getFullName(), u.getEmail(), u.getUserId());
        }
        return r.getReturnOwnerName() == null ? null : new Person(r.getReturnOwnerName(), null, null);
    }

    private Map<String, Person> directory() {
        Map<String, Person> map = new HashMap<>();
        for (User u : users.findByIsActiveTrue()) {
            if (u.getFullName() != null) {
                map.putIfAbsent(u.getFullName().trim().toLowerCase(Locale.ROOT),
                    new Person(u.getFullName(), u.getEmail(), u.getUserId()));
            }
        }
        for (Owner o : owners.findAll()) {
            if (Boolean.TRUE.equals(o.getIsActive()) && o.getFullName() != null) {
                map.putIfAbsent(o.getFullName().trim().toLowerCase(Locale.ROOT),
                    new Person(o.getFullName(), o.getEmail(), o.getUserId()));
            }
        }
        return map;
    }
}
