package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

class RequirementMergeServiceTest {

    private final RequirementRepository requirements = mock(RequirementRepository.class);
    private final RiskObligationRepository riskObligations = mock(RiskObligationRepository.class);
    private final RequirementMergeService service = new RequirementMergeService(requirements, riskObligations);

    private static Requirement req(long id, long obligation, int ordinal, String text) {
        return Requirement.builder().requirementId(id).obligationId(obligation).ordinal(ordinal).text(text).build();
    }

    @Test
    void aDuplicateRequirementIsDroppedAndAnUnseenOneMovesAfterTheKeepersLastOrdinal() {
        Requirement keeperA = req(1, 10, 0, "Identify the customer.");
        Requirement keeperB = req(2, 10, 1, "Verify identity.");
        Requirement loserDup = req(3, 20, 0, "identify the customer");
        Requirement loserNew = req(4, 20, 1, "Keep records for 5 years.");
        when(requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(anyCollection()))
            .thenReturn(List.of(keeperA, keeperB, loserDup, loserNew));
        when(riskObligations.findByObligationIdIn(anyCollection())).thenReturn(List.of());

        service.moveToKeeper(Map.of(20L, 10L));

        verify(requirements).delete(loserDup);
        verify(requirements, never()).delete(loserNew);
        assertEquals(10L, loserNew.getObligationId());
        assertEquals(2, loserNew.getOrdinal(), "appended after the keeper's last ordinal (1)");
        verify(requirements).save(loserNew);
    }

    @Test
    void riskLinksAreRepointedWithoutDuplicatingAPairTheKeeperAlreadyHas() {
        when(requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(anyCollection())).thenReturn(List.of());
        RiskObligation shared = new RiskObligation(7, 20L);
        RiskObligation onlyLoser = new RiskObligation(8, 20L);
        when(riskObligations.findByObligationIdIn(Set20())).thenReturn(List.of(shared, onlyLoser));
        when(riskObligations.findByObligationIdIn(Set10())).thenReturn(List.of(new RiskObligation(7, 10L)));

        service.moveToKeeper(Map.of(20L, 10L));

        verify(riskObligations).delete(shared);
        verify(riskObligations).delete(onlyLoser);
        verify(riskObligations, times(1)).save(any(RiskObligation.class));
        verify(riskObligations).save(argThat(p -> p.getRiskId() == 8 && p.getObligationId().equals(10L)));
    }

    @Test
    void noMergesIsANoOp() {
        service.moveToKeeper(Map.of());
        verifyNoInteractions(requirements, riskObligations);
    }

    private static java.util.Collection<Long> Set20() { return org.mockito.ArgumentMatchers.argThat(c -> c != null && c.contains(20L)); }
    private static java.util.Collection<Long> Set10() { return org.mockito.ArgumentMatchers.argThat(c -> c != null && c.contains(10L) && !c.contains(20L)); }
}
