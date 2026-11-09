package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

class RequirementSnapshotServiceTest {

    private final RequirementRepository requirements = mock(RequirementRepository.class);
    private final RequirementControlRepository requirementControls = mock(RequirementControlRepository.class);
    private final RiskObligationRepository riskObligations = mock(RiskObligationRepository.class);
    private final RequirementSnapshotService service =
        new RequirementSnapshotService(requirements, requirementControls, riskObligations);

    private static Obligation ob(Long id, String title, String statement) {
        return Obligation.builder().obligationId(id).title(title).sectionReference("4")
            .description("The Bank shall do it").plainEnglishStatement(statement).build();
    }

    @Test
    void controlLinksAndEditsSurviveTheDeleteAndRecreateOfAReviewSave() {
        Obligation before = ob(1L, "Identification", "Identify customers");
        when(requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(anyCollection())).thenReturn(List.of(
            Requirement.builder().requirementId(10L).obligationId(1L).ordinal(0).text("Identify the customer")
                .riskId(7).stateOverride("COMPLIANT").overrideReason("audited").source("manual").build()));
        when(requirementControls.findByRequirementIdIn(anyCollection())).thenReturn(List.of(
            new RequirementControl(10L, 55)));
        when(riskObligations.findByObligationIdIn(anyCollection())).thenReturn(List.of(new RiskObligation(7, 1L)));

        RequirementSnapshotService.Snapshot snapshot = service.capture(List.of(before));

        Obligation recreated = ob(99L, "Identification", "Identify customers");
        when(requirements.save(any(Requirement.class))).thenAnswer(inv -> {
            Requirement r = inv.getArgument(0);
            r.setRequirementId(500L);
            return r;
        });
        Map<Long, Set<Integer>> restored = service.restore(snapshot, List.of(recreated));

        ArgumentCaptor<Requirement> saved = ArgumentCaptor.forClass(Requirement.class);
        verify(requirements).save(saved.capture());
        assertEquals(99L, saved.getValue().getObligationId());
        assertEquals("Identify the customer", saved.getValue().getText());
        assertEquals("COMPLIANT", saved.getValue().getStateOverride());
        assertEquals(7, saved.getValue().getRiskId());
        verify(requirementControls).save(argThat(rc -> rc.getRequirementId().equals(500L) && rc.getControlId() == 55));
        verify(riskObligations).save(argThat(p -> p.getRiskId() == 7 && p.getObligationId().equals(99L)));
        assertEquals(Set.of(55), restored.get(99L));
    }

    @Test
    void anObligationEditedInReviewNoLongerMatchingItsKeyStartsWithoutRequirements() {
        Obligation before = ob(1L, "Identification", "Identify customers");
        when(requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(anyCollection())).thenReturn(List.of(
            Requirement.builder().requirementId(10L).obligationId(1L).ordinal(0).text("x").build()));
        when(requirementControls.findByRequirementIdIn(anyCollection())).thenReturn(List.of());
        when(riskObligations.findByObligationIdIn(anyCollection())).thenReturn(List.of());

        RequirementSnapshotService.Snapshot snapshot = service.capture(List.of(before));
        service.restore(snapshot, List.of(ob(99L, "A completely different title", "Something else")));

        verify(requirements, never()).save(any());
    }

    @Test
    void capturingNothingIsANoOp() {
        assertTrue(service.capture(List.of()).byKey().isEmpty());
        verifyNoInteractions(requirements);
    }
}
