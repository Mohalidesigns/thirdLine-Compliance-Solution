package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

class RequirementMergeServiceTest {

    private final RequirementRepository requirements = mock(RequirementRepository.class);
    private final RequirementMergeService service = new RequirementMergeService(requirements);

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

        service.moveToKeeper(Map.of(20L, 10L));

        verify(requirements).delete(loserDup);
        verify(requirements, never()).delete(loserNew);
        assertEquals(10L, loserNew.getObligationId());
        assertEquals(2, loserNew.getOrdinal(), "appended after the keeper's last ordinal (1)");
        verify(requirements).save(loserNew);
    }

    @Test
    void noMergesIsANoOp() {
        service.moveToKeeper(Map.of());
        verifyNoInteractions(requirements);
    }
}
