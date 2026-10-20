package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/** C2: a link written from either side lands on both sides. */
class ControlLinkServiceTest {

    private final ControlRepository controls = mock(ControlRepository.class);
    private final ObligationRepository obligations = mock(ObligationRepository.class);
    private final ObligationClassificationRepository classifications = mock(ObligationClassificationRepository.class);
    private final ControlLinkService service = new ControlLinkService(controls, obligations, classifications);

    @Test
    void settingAControlsObligationsUpdatesEachClassification() {
        Control ctl = Control.builder().controlId(7).linkedObligationIds(new ArrayList<>(List.of(1L))).build();
        ObligationClassification c1 = ObligationClassification.builder().classificationId(11L).obligationId(1L).linkedControlIds(new ArrayList<>(List.of(7, 8))).build();
        ObligationClassification c2 = ObligationClassification.builder().classificationId(12L).obligationId(2L).linkedControlIds(new ArrayList<>()).build();
        when(obligations.findAllById(any())).thenReturn(List.of(Obligation.builder().obligationId(2L).build()));
        when(classifications.findByObligationIdIn(anyCollection())).thenReturn(List.of(c1, c2));

        service.setObligationsOfControl(ctl, List.of(2L));

        assertEquals(List.of(2L), ctl.getLinkedObligationIds());
        assertEquals(List.of(8), c1.getLinkedControlIds(), "unlinked obligation loses the control");
        assertEquals(List.of(7), c2.getLinkedControlIds(), "linked obligation gains it");
    }

    @Test
    void settingAnObligationsControlsUpdatesEachControl() {
        ObligationClassification cls = ObligationClassification.builder().obligationId(5L).linkedControlIds(new ArrayList<>(List.of(1))).build();
        Control old = Control.builder().controlId(1).linkedObligationIds(new ArrayList<>(List.of(5L, 6L))).build();
        Control added = Control.builder().controlId(2).linkedObligationIds(new ArrayList<>()).build();
        when(controls.findAllById(any())).thenAnswer(inv -> {
            Collection<?> ids = inv.getArgument(0);
            List<Control> out = new ArrayList<>();
            if (ids.contains(1)) out.add(old);
            if (ids.contains(2)) out.add(added);
            return out;
        });
        when(classifications.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setControlsOfObligation(cls, List.of(2));

        assertEquals(List.of(2), cls.getLinkedControlIds());
        assertEquals(List.of(6L), old.getLinkedObligationIds());
        assertEquals(List.of(5L), added.getLinkedObligationIds());
    }

    @Test
    void unknownIdsAreRejected() {
        when(obligations.findAllById(any())).thenReturn(List.of());
        Control ctl = Control.builder().controlId(7).build();
        assertThrows(ApiException.class, () -> service.setObligationsOfControl(ctl, List.of(999999L)));
        when(controls.findAllById(any())).thenReturn(List.of());
        ObligationClassification cls = ObligationClassification.builder().obligationId(5L).build();
        assertThrows(ApiException.class, () -> service.setControlsOfObligation(cls, List.of(424242)));
    }
}
