package com.atheris.compliance.tenant.backend.modules.escalation.engine;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EscalationCcTargetsTest {

    private final EscalationDeliveryService service = new EscalationDeliveryService(null, null, null);

    @Test
    void copiesOwnerThenAssignees() {
        Person owner = new Person("Adaeze Analyst", "analyst@x.test", 3);
        EscalationCandidate candidate = candidate(List.of(
            new Person("Halima Sani", "aml@x.test", 7),
            new Person("Bode Ajayi", "treasury@x.test", 9)), owner);

        assertEquals(List.of("analyst@x.test", "aml@x.test", "treasury@x.test"),
            service.ccTargets(candidate, owner));
    }

    @Test
    void skipsPeopleWithoutEmail() {
        Person owner = new Person("Adaeze Analyst", "analyst@x.test", 3);
        EscalationCandidate candidate = candidate(List.of(
            new Person("No Mail", null, null),
            new Person(null, "  ", null),
            new Person("Bode Ajayi", "treasury@x.test", 9)), owner);

        assertEquals(List.of("analyst@x.test", "treasury@x.test"), service.ccTargets(candidate, owner));
    }

    @Test
    void assigneesOnlyWhenNoOwner() {
        EscalationCandidate candidate = candidate(List.of(new Person("Halima Sani", "aml@x.test", 7)), null);

        assertEquals(List.of("aml@x.test"), service.ccTargets(candidate, null));
    }

    @Test
    void emptyWhenNobodyHasEmail() {
        EscalationCandidate candidate = candidate(List.of(), new Person("Owner", null, null));

        assertEquals(List.of(), service.ccTargets(candidate, new Person("Owner", null, null)));
    }

    private EscalationCandidate candidate(List<Person> assignees, Person owner) {
        return new EscalationCandidate(
            "RETURN", 42L, "Report fx transactions", 11L,
            assignees, owner,
            LocalDateTime.of(2026, 10, 26, 0, 0), null,
            1L, "/returns/", "RETURNS", Map.of(), "DAILY", true, false);
    }
}
