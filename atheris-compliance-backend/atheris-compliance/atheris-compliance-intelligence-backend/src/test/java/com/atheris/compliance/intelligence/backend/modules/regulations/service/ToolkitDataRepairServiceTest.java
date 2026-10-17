package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed.ToolkitSeedDoc;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ToolkitDataRepairServiceTest {

    private final InstrumentRepository instruments = mock(InstrumentRepository.class);
    private final ObligationMappingRepository obligations = mock(ObligationMappingRepository.class);
    private final ComplianceControlRepository controls = mock(ComplianceControlRepository.class);
    private Map<String, List<ToolkitSeedDoc.ObligationRow>> seed = Map.of();
    private final ToolkitDataRepairService service =
        new ToolkitDataRepairService(instruments, obligations, controls, new ObjectMapper()) {
            @Override
            Map<String, List<ToolkitSeedDoc.ObligationRow>> seedSections() { return seed; }
        };

    private static ToolkitSeedDoc.ObligationRow seedRow(String source, String likelihood, String impact,
                                                        String primary, String additional) {
        ToolkitSeedDoc.ObligationRow r = new ToolkitSeedDoc.ObligationRow();
        r.setSource(source);
        r.setLikelihoodInherent(likelihood);
        r.setImpactInherent(impact);
        r.setPrimaryControl(primary);
        r.setAdditionalControl(additional);
        return r;
    }

    private static ComplianceControl control(String act, String type, String text, String riskLevel,
                                             String resL, String resI, String residual) {
        return ComplianceControl.builder().controlNumber(type + text).actName(act).controlType(type)
            .complianceControl(text).riskLevel(riskLevel)
            .residualLikelihood(resL).residualImpact(resI).residualRiskRating(residual).build();
    }

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

    @Test
    void rebandsSeededControlsFromTheSeedRowAndTheirResidualFromTheRow() {
        seed = Map.of("crmp", List.of(
            seedRow("Pension Act", "Medium", "High", "Staff  enrolment in CPS.", "HR audit."),
            seedRow("CBN Act", "Very High", "High", "Board oversight.", null)));
        ComplianceControl primary = control("Pension Act", "PRIMARY", "staff enrolment in cps.", "Critical", "Medium", "Medium", "High");
        ComplianceControl additional = control("Pension Act", "ADDITIONAL", "HR audit.", "Critical", "Low", "Medium", "Moderate");
        ComplianceControl stillCritical = control("CBN Act", "PRIMARY", "Board oversight.", "Critical", "Medium", "High", "Critical");
        ComplianceControl adminEdited = control("Pension Act", "PRIMARY", "Staff enrolment in CPS.", "Low", null, null, null);
        ComplianceControl notInSeed = control("Other Act", "PRIMARY", "Something else.", "Critical", null, null, null);
        when(instruments.findByUploadSource("toolkit_seed")).thenReturn(List.of());
        when(obligations.findByInstrumentIdIn(any())).thenReturn(List.of());
        when(controls.findAll()).thenReturn(List.of(primary, additional, stillCritical, adminEdited, notInSeed));

        ToolkitDataRepairService.Result r = service.repair();

        assertEquals("High", primary.getRiskLevel(), "Medium x High = 12 is High, not Critical");
        assertEquals("Moderate", primary.getResidualRiskRating(), "Medium x Medium = 9 is Moderate");
        assertEquals("High", additional.getRiskLevel());
        assertEquals("Moderate", additional.getResidualRiskRating(), "Low x Medium = 6 was already Moderate");
        assertEquals("Critical", stillCritical.getRiskLevel(), "Very High x High = 20 stays Critical");
        assertEquals("High", stillCritical.getResidualRiskRating());
        assertEquals("Low", adminEdited.getRiskLevel(), "a rating that is not the old band is kept");
        assertEquals("Critical", notInSeed.getRiskLevel(), "no seed row, no inputs, no change");
        assertEquals(2, r.controlRiskRebanded());
        assertEquals(2, r.controlResidualRebanded());
    }

    @Test
    void controlRepairIsIdempotent() {
        seed = Map.of("amlcft", List.of(seedRow("AML Act", "High", "Medium", "KYC review.", null)));
        ComplianceControl c = control("AML Act", "PRIMARY", "KYC review.", "Critical", "Medium", "High", "Critical");
        when(instruments.findByUploadSource("toolkit_seed")).thenReturn(List.of());
        when(obligations.findByInstrumentIdIn(any())).thenReturn(List.of());
        when(controls.findAll()).thenReturn(List.of(c));

        service.repair();
        ToolkitDataRepairService.Result second = service.repair();

        assertEquals("High", c.getRiskLevel());
        assertEquals("High", c.getResidualRiskRating());
        assertEquals(0, second.controlRiskRebanded());
        assertEquals(0, second.controlResidualRebanded());
    }
}
