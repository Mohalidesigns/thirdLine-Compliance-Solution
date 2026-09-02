package com.atheris.compliance.intelligence.backend.modules.internal.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.internal.dto.InternalRegulationSeed;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.common.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service @Slf4j @RequiredArgsConstructor
public class InternalRegulationSeedService {

    private final RegulationRepository regulations;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final RegulatoryReturnRepository returns;
    private final ComplianceControlRepository complianceControls;
    private final RegulatorRepository regulatorRepo;

    public List<InternalRegulationSeed> seedForRegulators(List<Integer> regulatorIds) {
        if (regulatorIds == null || regulatorIds.isEmpty()) return List.of();

        Set<Long> regulationIds = new LinkedHashSet<>();
        for (Integer regId : regulatorIds) {
            List<Regulation> direct = regulations.findByRegulatorId(regId);
            direct.forEach(r -> regulationIds.add(r.getRegulationId()));
            // regulations whose canonical instrument carries the regulatorId
            instruments.findByRegulatorIdOrderByDiscoveredAtDesc(regId).stream()
                .map(Instrument::getRegulationId)
                .filter(Objects::nonNull)
                .forEach(regulationIds::add);
        }

        List<InternalRegulationSeed> out = new ArrayList<>();
        for (Long rid : regulationIds) {
            Regulation r = regulations.findById(rid).orElse(null);
            if (r == null || r.getCanonicalInstrumentId() == null) continue;
            Instrument canon = instruments.findById(r.getCanonicalInstrumentId()).orElse(null);
            if (canon == null || !Constants.INST_PUBLISHED.equals(canon.getStatus())) continue;

            Integer regulatorId = r.getRegulatorId() != null ? r.getRegulatorId() : canon.getRegulatorId();
            String regulatorName = null;
            String regulatorAbbreviation = null;
            if (regulatorId != null) {
                var regOpt = regulatorRepo.findById(regulatorId);
                if (regOpt.isPresent()) {
                    regulatorName = regOpt.get().getName();
                    regulatorAbbreviation = regOpt.get().getAbbreviation();
                }
            }

            out.add(InternalRegulationSeed.builder()
                .regulationId(r.getRegulationId())
                .regulationName(r.getName())
                .regulationAbbreviation(r.getAbbreviation())
                .regulatorId(regulatorId)
                .regulatorName(regulatorName)
                .regulatorAbbreviation(regulatorAbbreviation)
                .canonicalInstrument(InternalRegulationSeed.InstrumentItem.builder()
                    .instrumentId(canon.getInstrumentId())
                    .sourceTitle(canon.getSourceTitle())
                    .sourceReferenceNumber(canon.getSourceReferenceNumber())
                    .dateIssued(canon.getDateIssued())
                    .dateCommencement(canon.getDateCommencement())
                    .riskRating(canon.getRiskRating())
                    .nature(canon.getNature())
                    .areaOfFocus(canon.getAreaOfFocus())
                    .aiSummary(canon.getAiSummary())
                    .pdfUrl(canon.getPdfUrl())
                    .publishedAt(canon.getPublishedAt())
                    .status(canon.getStatus())
                    .build())
                .obligations(obligations.findByRegulationId(r.getRegulationId()).stream()
                    .map(o -> InternalRegulationSeed.ObligationItem.builder()
                        .obligationNumber(o.getObligationNumber())
                        .title(o.getTitle())
                        .plainEnglishStatement(o.getPlainEnglishStatement())
                        .specificSectionReference(o.getSpecificSectionReference())
                        .areaOfFocus(o.getAreaOfFocus())
                        .obligationType(o.getObligationType())
                        .recurringDeadlineType(o.getRecurringDeadlineType())
                        .riskDescription(o.getRiskDescription())
                        .inherentLikelihood(o.getInherentLikelihood())
                        .inherentImpact(o.getInherentImpact())
                        .inherentRiskRating(o.getInherentRiskRating())
                        .controlOwner(o.getControlOwner())
                        .build())
                    .toList())
                .sanctions(sanctions.findByRegulationId(r.getRegulationId()).stream()
                    .map(s -> InternalRegulationSeed.SanctionItem.builder()
                        .sanctionType(s.getSanctionType())
                        .sanctionAmountNaira(s.getSanctionAmountNaira())
                        .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                        .liableRoles(s.getLiableRoles())
                        .severityScore(s.getSeverityScore())
                        .hasBeenEnforced(s.getHasBeenEnforced())
                        .description(s.getDescription())
                        .sourceSectionReference(s.getSourceSectionReference())
                        .riskExplanation(s.getRiskExplanation())
                        .penaltyDetails(s.getPenaltyDetails())
                        .build())
                    .toList())
                .returns(returns.findByActId(r.getRegulationId()).stream()
                    .map(rt -> InternalRegulationSeed.ReturnItem.builder()
                        .title(rt.getTitle())
                        .sectionReference(rt.getSectionReference())
                        .statutoryBasis(rt.getStatutoryBasis())
                        .responsibleUnit(rt.getResponsibleUnit())
                        .responsiblePerson(rt.getResponsiblePerson())
                        .frequency(rt.getFrequency())
                        .deadline(rt.getDeadline())
                        .filingDate(rt.getFilingDate())
                        .build())
                    .toList())
                .controls(complianceControls.findByActId(r.getRegulationId()).stream()
                    .map(c -> InternalRegulationSeed.ControlItem.builder()
                        .controlNumber(c.getControlNumber())
                        .theme(c.getTheme())
                        .regulatoryRequirement(c.getRegulatoryRequirement())
                        .complianceArea(c.getComplianceArea())
                        .riskLevel(c.getRiskLevel())
                        .complianceControl(c.getComplianceControl())
                        .monitoringActivity(c.getMonitoringActivity())
                        .frequency(c.getFrequency())
                        .responsibleOfficer(c.getResponsibleOfficer())
                        .dueDate(c.getDueDate())
                        .status(c.getStatus())
                        .controlEffectivenessMeasure(c.getControlEffectivenessMeasure())
                        .actName(c.getActName())
                        .obligationId(c.getObligationId())
                        .controlType(c.getControlType())
                        .residualLikelihood(c.getResidualLikelihood())
                        .residualImpact(c.getResidualImpact())
                        .residualRiskRating(c.getResidualRiskRating())
                        .ownerName(c.getOwnerName())
                        .linkedObligationIds(c.getLinkedObligationIds())
                        .build())
                    .toList())
                .build());
        }
        log.info("Built {} regulation seed bundles for {} regulators", out.size(), regulatorIds.size());
        return out;
    }
}