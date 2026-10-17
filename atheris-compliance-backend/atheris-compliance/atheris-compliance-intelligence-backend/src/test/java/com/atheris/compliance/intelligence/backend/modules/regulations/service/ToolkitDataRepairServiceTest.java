package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ToolkitDataRepairServiceTest {

    private final InstrumentRepository instruments = mock(InstrumentRepository.class);
    private final ObligationMappingRepository obligations = mock(ObligationMappingRepository.class);
    private final ToolkitDataRepairService service = new ToolkitDataRepairService(instruments, obligations);

    private Instrument instrument(long id, String area) {
        return Instrument.builder().instrumentId(id).areaOfFocus(area).uploadSource("toolkit_seed").build();
    }

    private ObligationMapping obligation(long instrumentId, String likelihood, String impact, String rating, String area) {
        return ObligationMapping.builder().instrumentId(instrumentId)
            .inherentLikelihood(likelihood).inherentImpact(impact).inherentRiskRating(rating)
            .areaOfFocus(area).build();
    }

    @Test
    void rebandsInflatedRiskAndInheritsInstrumentArea() {
        Instrument withArea = instrument(1, "AML/CFT/CPF");
        Instrument noArea = instrument(2, null);
        ObligationMapping crmpUnderAml = obligation(1, "Medium", "High", "Critical", "Compliance Risk Management");
        ObligationMapping crmpNoArea = obligation(2, "High", "High", "Critical", "Compliance Risk Management");
        ObligationMapping sectionAlias = obligation(2, "Low", "Low", "Low", "Conduct Risk");
        when(instruments.findByUploadSource("toolkit_seed")).thenReturn(List.of(withArea, noArea));
        when(obligations.findByInstrumentIdIn(any())).thenReturn(List.of(crmpUnderAml, crmpNoArea, sectionAlias));

        ToolkitDataRepairService.Result r = service.repair();

        assertEquals("High", crmpUnderAml.getInherentRiskRating());
        assertEquals("AML/CFT/CPF", crmpUnderAml.getAreaOfFocus());
        assertEquals("High", crmpNoArea.getInherentRiskRating());
        assertNull(crmpNoArea.getAreaOfFocus(), "the generic CRMP sheet is not an area");
        assertEquals("People and Conduct Risk", sectionAlias.getAreaOfFocus());
        assertEquals(2, r.riskRebanded());
        assertEquals(3, r.areaReassigned());
    }

    @Test
    void secondRunChangesNothing() {
        Instrument withArea = instrument(1, "Data Protection");
        ObligationMapping o = obligation(1, "Medium", "High", "Critical", "Compliance Risk Management");
        when(instruments.findByUploadSource("toolkit_seed")).thenReturn(List.of(withArea));
        when(obligations.findByInstrumentIdIn(any())).thenReturn(List.of(o));

        service.repair();
        ToolkitDataRepairService.Result second = service.repair();

        assertEquals(0, second.riskRebanded());
        assertEquals(0, second.areaReassigned());
        assertEquals(0, second.instrumentsUpdated());
    }

    @Test
    void unknownRatingsAreLeftAlone() {
        when(instruments.findByUploadSource("toolkit_seed")).thenReturn(List.of(instrument(1, "ESG")));
        ObligationMapping o = obligation(1, null, "High", "High", "ESG");
        when(obligations.findByInstrumentIdIn(any())).thenReturn(List.of(o));

        ToolkitDataRepairService.Result r = service.repair();

        assertEquals("High", o.getInherentRiskRating());
        assertEquals(0, r.riskRebanded());
    }
}
