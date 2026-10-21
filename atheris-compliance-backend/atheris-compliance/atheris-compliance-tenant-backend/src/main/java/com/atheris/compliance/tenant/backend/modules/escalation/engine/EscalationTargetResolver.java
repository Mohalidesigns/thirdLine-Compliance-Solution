package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelDto;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class EscalationTargetResolver {

    private final UserRepository users;

    public List<EscalationTarget> resolve(EscalationLevelDto level, List<Person> assignees, Person owner) {
        String type = level.getTargetType() == null ? "" : level.getTargetType().toUpperCase(Locale.ROOT);
        return switch (type) {
            case EscalationConstants.TARGET_PERSON ->
                List.of(new EscalationTarget(level.getTargetName(), level.getTargetEmail(), level.getTargetUserId(), null));
            case EscalationConstants.TARGET_ROLE ->
                List.of(new EscalationTarget(null, null, null, level.getTargetRole()));
            case EscalationConstants.TARGET_MANAGER -> oneOrCco(managerOf(firstWithUser(assignees)));
            case EscalationConstants.TARGET_MANAGER_OF_MANAGER -> oneOrCco(managerOf(managerOf(firstWithUser(assignees))));
            default -> assigneeTargets(assignees, owner);
        };
    }

    public List<EscalationTarget> assigneeTargets(List<Person> assignees, Person owner) {
        List<EscalationTarget> out = new ArrayList<>();
        for (Person p : assignees == null ? List.<Person>of() : assignees) {
            if (p.hasEmail() || p.userId() != null) out.add(new EscalationTarget(p.name(), p.email(), p.userId(), null));
        }
        if (out.isEmpty() && owner != null && (owner.hasEmail() || owner.userId() != null)) {
            out.add(new EscalationTarget(owner.name(), owner.email(), owner.userId(), null));
        }
        return out;
    }

    public String emailOf(Integer userId) {
        return userId == null ? null : users.findById(userId).map(User::getEmail).orElse(null);
    }

    public String nameOf(Integer userId) {
        return userId == null ? null : users.findById(userId).map(User::getFullName).orElse(null);
    }

    public List<String> activeEmailsOfRole(String role) {
        return role == null ? List.of() : users.findByRoleAndIsActiveTrue(role).stream()
            .map(User::getEmail).filter(Objects::nonNull).toList();
    }

    private List<EscalationTarget> oneOrCco(Integer userId) {
        if (userId == null) return List.of(new EscalationTarget(null, null, null, AppRole.CCO));
        User u = users.findById(userId).orElse(null);
        if (u == null) return List.of(new EscalationTarget(null, null, null, AppRole.CCO));
        return List.of(new EscalationTarget(u.getFullName(), u.getEmail(), u.getUserId(), null));
    }

    private Integer managerOf(Person person) {
        return person == null ? null : managerOf(person.userId());
    }

    private Integer managerOf(Integer userId) {
        return userId == null ? null : users.findById(userId).map(User::getManagerUserId).orElse(null);
    }

    private Person firstWithUser(List<Person> assignees) {
        return (assignees == null ? List.<Person>of() : assignees).stream()
            .filter(p -> p.userId() != null).findFirst().orElse(null);
    }
}
