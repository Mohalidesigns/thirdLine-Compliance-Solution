package com.atheris.compliance.tenant.backend.modules.escalation.handler;

import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationCandidate;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.EscalationSubjectHandler;
import com.atheris.compliance.tenant.backend.modules.escalation.engine.Person;
import com.atheris.compliance.tenant.backend.modules.ldap.service.LdapAuthService;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.returns.service.ReturnUploadLinkService;
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
    private final ReturnUploadLinkService uploadLinks;
    private final LdapAuthService ldap;
    private final ObligationRepository obligations;

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
        Set<Long> oldestPerReturn = new HashSet<>();
        List<EscalationCandidate> out = new ArrayList<>();
        for (ReturnFilingInstance instance : found) {
            RegulatoryReturn r = byId.get(instance.getReturnId());
            if (r == null || instance.getDueDate() == null) continue;
            if (instance.isPendingReview()) continue;
            Map<String, String> extra = new HashMap<>();
            extra.put("period", instance.getPeriod() == null ? "" : instance.getPeriod());
            extra.put("regulator", r.getFilingRegulator() == null ? "" : r.getFilingRegulator());
            extra.put("actName", r.getActName() == null ? "" : r.getActName());
            extra.put("actObligation", actOrObligation(r));
            extra.put("responsiblePerson", responsibleLabel(r));
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
                extra,
                r.getFrequencyType(),
                instance.getCurrentStage() != null && instance.getCurrentStage() != ReturnStage.NOT_STARTED,
                oldestPerReturn.add(r.getReturnId())));
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

    @Override
    public boolean remindUnstarted() {
        return true;
    }

    @Override
    public Optional<String> filingLink(EscalationCandidate candidate) {
        RegulatoryReturn r = returns.findById(candidate.linkSubjectId()).orElse(null);
        if (r == null || "EVENT_DRIVEN".equalsIgnoreCase(r.getFrequencyType())) return Optional.empty();
        String recipient = firstEmail(candidate);
        if (recipient == null) return Optional.empty();
        try {
            String raw = uploadLinks.createFilingLink(r.getReturnId(), candidate.subjectId(), recipient, null, null);
            return Optional.of("/return-upload/" + raw);
        } catch (RuntimeException e) {
            log.warn("[Escalation] filing link failed for return {}: {}", r.getReturnId(), e.getMessage());
            return Optional.empty();
        }
    }

    private String firstEmail(EscalationCandidate candidate) {
        for (Person p : candidate.assignees() == null ? List.<Person>of() : candidate.assignees()) {
            if (p.hasEmail()) return p.email();
        }
        return candidate.owner() != null && candidate.owner().hasEmail() ? candidate.owner().email() : null;
    }

    private List<Person> assignees(RegulatoryReturn r, Map<String, Person> directory) {
        List<Person> out = new ArrayList<>();
        for (String name : r.getResponsiblePersons() == null ? List.<String>of() : r.getResponsiblePersons()) {
            if (name == null || name.isBlank()) continue;
            Person person = directory.get(name.trim().toLowerCase(Locale.ROOT));
            if (person != null) out.add(person);
            else if (name.contains("@")) out.add(new Person(null, name.trim(), null));
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

    private String actOrObligation(RegulatoryReturn r) {
        if (r.getActName() != null && !r.getActName().isBlank()) return r.getActName().trim();
        for (ObligationRepository.LinkedObligationRow o : obligations.findLinkedObligationDetails(r.getReturnId())) {
            String label = firstNonBlank(o.getActName(), o.getTitle(), o.getName(),
                truncate(o.getPlainEnglishStatement(), 120));
            if (label != null) return label;
            if (o.getObligationId() != null) return "Obligation #" + o.getObligationId();
        }
        return "";
    }

    private static String responsibleLabel(RegulatoryReturn r) {
        List<String> persons = r.getResponsiblePersons() == null ? List.of() : r.getResponsiblePersons();
        if (!persons.isEmpty()) return String.join(", ", persons);
        return r.getResponsiblePerson() == null ? "" : r.getResponsiblePerson();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static String truncate(String text, int max) {
        if (text == null || text.isBlank()) return null;
        String t = text.trim();
        return t.length() <= max ? t : t.substring(0, max - 1).trim() + "\u2026";
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
        if (ldap.isLdapEnabled()) {
            for (LdapAuthService.DirectoryUser u : ldap.searchUsers("")) {
                if (u.fullName() != null && !u.fullName().isBlank() && u.email() != null && !u.email().isBlank()) {
                    map.putIfAbsent(u.fullName().trim().toLowerCase(Locale.ROOT),
                        new Person(u.fullName(), u.email(), null));
                }
            }
        }
        return map;
    }
}
