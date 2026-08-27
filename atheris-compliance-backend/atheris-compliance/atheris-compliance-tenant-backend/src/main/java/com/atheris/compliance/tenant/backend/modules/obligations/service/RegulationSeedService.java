package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service @Slf4j @RequiredArgsConstructor
public class RegulationSeedService {

    private final PlatformApiClient platform;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classifications;
    private final RegulatorySanctionRepository sanctions;
    private final RegulatoryReturnRepository returns;
    private final ControlRepository controlRepo;
    private final TenantIdentityService tenantIdentity;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int seedAll() {
        Long tenantId = tenantIdentity.currentTenantId();
        List<TenantRegulator> regs = tenantRegulators.findByTenantIdAndIsActiveTrue(tenantId).stream()
            .filter(r -> r.getPlatformRegulatorId() != null)
            .toList();
        List<Integer> platformIds = regs.stream()
            .map(TenantRegulator::getPlatformRegulatorId)
            .sorted()
            .distinct()
            .toList();
        if (platformIds.isEmpty()) {
            log.info("Seed skipped: no active regulators for tenant {}", tenantId);
            return 0;
        }

        List<PlatformRegulationSeed> bundles = platform.fetchRegulationSeeds(platformIds);
        int seeded = 0;
        for (PlatformRegulationSeed bundle : bundles) {
            seeded += seedBundle(bundle, regs);
        }
        log.info("Seed complete for tenant {}: {} regulation bundles processed", tenantId, bundles.size());
        return seeded;
    }

    private int seedBundle(PlatformRegulationSeed bundle, List<TenantRegulator> tenantRegs) {
        if (bundle.getCanonicalInstrument() == null
            || bundle.getCanonicalInstrument().getInstrumentId() == null) return 0;
        Long instrumentId = bundle.getCanonicalInstrument().getInstrumentId();

        boolean hasObligations = obligationRepo.countByInstrumentId(instrumentId) > 0;
        TenantRegulator reg = tenantRegs.stream()
            .filter(r -> bundle.getRegulatorId() != null
                && bundle.getRegulatorId().equals(r.getPlatformRegulatorId()))
            .findFirst().orElse(null);

        LocalDate effDate = bundle.getCanonicalInstrument().getDateCommencement() != null
            ? bundle.getCanonicalInstrument().getDateCommencement()
            : bundle.getCanonicalInstrument().getDateIssued();

        List<Obligation> createdObligations = new ArrayList<>();
        if (!hasObligations && bundle.getObligations() != null) {
            int num = 1;
            for (PlatformRegulationSeed.ObligationItem o : bundle.getObligations()) {
                Obligation ob = Obligation.builder()
                    .instrumentId(instrumentId)
                    .obligationNumber(o.getObligationNumber() != null ? o.getObligationNumber() : num)
                    .description(o.getPlainEnglishStatement())
                    .sectionReference(o.getSpecificSectionReference())
                    .areaOfFocus(o.getAreaOfFocus())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .effectiveDate(effDate)
                    .status("active")
                    .source("seeded")
                    .build();
                ob = obligationRepo.save(ob);
                classifications.save(ObligationClassification.builder()
                    .instrumentId(instrumentId)
                    .obligationId(ob.getObligationId())
                    .applicability("applicable")
                    .status("active")
                    .classificationVersion(1)
                    .classifiedAt(Instant.now())
                    .build());
                createdObligations.add(ob);
                num++;
            }
        }

        if (bundle.getReturns() != null) {
            for (PlatformRegulationSeed.ReturnItem r : bundle.getReturns()) {
                if (r.getTitle() == null || r.getTitle().isBlank()) continue;
                Long regId = reg != null ? reg.getId() : null;
                if (returns.existsByReturnNameAndTenantRegulatorId(r.getTitle(), regId)) continue;
                String label = r.getResponsibleUnit() != null && !r.getResponsibleUnit().isBlank()
                    ? r.getResponsibleUnit()
                    : (reg != null ? (reg.getAbbreviation() != null ? reg.getAbbreviation() : reg.getName()) : null);
                RegulatoryReturn rt = returns.save(RegulatoryReturn.builder()
                    .returnName(r.getTitle())
                    .filingRegulator(label)
                    .tenantRegulatorId(regId)
                    .actId(bundle.getRegulationId())
                    .actName(bundle.getRegulationName())
                    .frequency(normalizeFrequency(r.getFrequency()))
                    .frequencyType(r.getFrequencyType() != null ? r.getFrequencyType() : "MONTHLY")
                    .filingDate(r.getFilingDate())
                    .responsibleUnit(r.getResponsibleUnit())
                    .responsiblePerson(r.getResponsiblePerson())
                    .status(com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus.ACTIVE)
                    .build());
                List<Obligation> toLink = createdObligations.isEmpty()
                    ? obligationRepo.findByInstrumentId(instrumentId)
                    : createdObligations;
                for (Obligation ob : toLink) {
                    obligationRepo.insertReturnLink(ob.getObligationId(), rt.getReturnId());
                }
            }
        }

        if (bundle.getSanctions() != null) {
            for (PlatformRegulationSeed.SanctionItem s : bundle.getSanctions()) {
                sanctions.save(RegulatorySanction.builder()
                    .instrumentId(instrumentId)
                    .regulationId(bundle.getRegulationId())
                    .regulationName(bundle.getRegulationName())
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
                    .build());
            }
        }

        int seededControls = 0;
        if (bundle.getControls() != null) {
            for (PlatformRegulationSeed.ControlItem c : bundle.getControls()) {
                if (c.getControlNumber() == null || c.getControlNumber().isBlank()) continue;
                if (controlRepo.existsByControlNumber(c.getControlNumber())) continue;

                // Link all obligations from this instrument to the control
                List<Long> linkedIds = createdObligations.stream()
                    .map(Obligation::getObligationId)
                    .toList();
                if (linkedIds.isEmpty()) {
                    linkedIds = obligationRepo.findByInstrumentId(instrumentId).stream()
                        .map(Obligation::getObligationId)
                        .toList();
                }

                controlRepo.save(Control.builder()
                    .controlNumber(c.getControlNumber())
                    .name(c.getComplianceControl() != null ? c.getComplianceControl() : c.getComplianceArea())
                    .description(c.getComplianceControl())
                    .theme(c.getTheme())
                    .controlType("CMP")
                    .whatItDoes(c.getMonitoringActivity())
                    .howTested(c.getComplianceControl())
                    .controlOwnerName(c.getResponsibleOfficer())
                    .testFrequency(c.getFrequency())
                    .inherentRisk(c.getRiskLevel())
                    .residualRisk(c.getRiskLevel())
                    .linkedObligationIds(linkedIds)
                    .regulatoryRequirement(c.getRegulatoryRequirement())
                    .complianceArea(c.getComplianceArea())
                    .monitoringActivity(c.getMonitoringActivity())
                    .dueDate(c.getDueDate())
                    .controlEffectivenessMeasure(c.getControlEffectivenessMeasure())
                    .actId(bundle.getRegulationId() != null ? bundle.getRegulationId().intValue() : null)
                    .status("Active")
                    .build());
                seededControls++;
            }
        }

        log.info("Seeded instrument {} ({}): {} obligations, {} sanctions, returns {}, controls {}",
            instrumentId, bundle.getRegulationName(),
            createdObligations.size(),
            bundle.getSanctions() != null ? bundle.getSanctions().size() : 0,
            bundle.getReturns() != null ? bundle.getReturns().size() : 0,
            seededControls);
        return createdObligations.size();
    }

    private Integer parseDueDayFromFrequency(String frequency) {
        if (frequency == null || frequency.isBlank()) return 1;
        String f = frequency.trim().toLowerCase();
        // "Monthly, on or before 5th" / "on or before the 5th day"
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("on\\s+or\\s+before\\s+(?:the\\s+)?(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        // "by June 30" / "by 31st Dec" / "By March 15"
        m = java.util.regex.Pattern.compile("by\\s+\\w+\\s+(\\d+)(?:st|nd|rd|th)?").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        // "by 31st Dec"
        m = java.util.regex.Pattern.compile("by\\s+(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        // "Within 5 days after month-end"
        m = java.util.regex.Pattern.compile("within\\s+(\\d+)\\s+days?\\s+after\\s+month").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        // bare number: "5th" / "the 5th"
        m = java.util.regex.Pattern.compile("(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        // "5 days after month-end"
        m = java.util.regex.Pattern.compile("(\\d+)\\s+days?\\s+after\\s+month").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        return 1;
    }

    private String normalizeFrequency(String frequency) {
        if (frequency == null || frequency.isBlank()) return null;
        String f = frequency.trim().toLowerCase();
        if (f.contains("daily")) return "Daily";
        if (f.contains("weekly")) return "Weekly";
        if (f.contains("semi") || f.contains("twice yearly") || f.contains("every 6 months")) return "Semi-Annual";
        if (f.contains("quarter")) return "Quarterly";
        if (f.contains("every 2 years") || f.contains("biennial")) return "Biennial";
        if (f.contains("annual") || f.contains("year")) return "Annually";
        if (f.contains("monthly")) return "Monthly";
        // Event-driven — keep first 50 chars
        return frequency.length() <= 50 ? frequency.trim() : frequency.trim().substring(0, 50);
    }
}