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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    private final PlatformTransactionManager txManager;

    // Each regulation bundle is seeded in its own REQUIRES_NEW transaction via a TransactionTemplate,
    // so a single failing bundle rolls back only itself (not the whole seed run). This also avoids
    // the self-injection/proxy pitfalls of annotating a private method with @Transactional.
    private TransactionTemplate txTemplate;

    @PostConstruct
    void init() {
        txTemplate = new TransactionTemplate(txManager);
        txTemplate.setPropagationBehavior(Propagation.REQUIRES_NEW.value());
    }

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
            try {
                seeded += txTemplate.execute(status -> seedBundle(bundle, regs));
            } catch (Exception e) {
                log.error("[SeedDebug] seedBundle transaction rolled back for regulationId={} instrumentId={}: {}",
                    bundle.getRegulationId(),
                    bundle.getCanonicalInstrument() != null ? bundle.getCanonicalInstrument().getInstrumentId() : null,
                    e.getMessage());
            }
        }
        log.info("Seed complete for tenant {}: {} regulation bundles processed", tenantId, bundles.size());
        return seeded;
    }

    private int seedBundle(PlatformRegulationSeed bundle, List<TenantRegulator> tenantRegs) {
        if (bundle.getCanonicalInstrument() == null
            || bundle.getCanonicalInstrument().getInstrumentId() == null) {
            log.warn("[SeedDebug] seedBundle SKIPPED: canonicalInstrument null for regulationId={}", bundle.getRegulationId());
            return 0;
        }
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
        List<ObligationClassification> createdClassifications = new ArrayList<>();
        if (!hasObligations && bundle.getObligations() != null) {
            int num = 1;
            for (PlatformRegulationSeed.ObligationItem o : bundle.getObligations()) {
                Obligation ob = Obligation.builder()
                    .instrumentId(instrumentId)
                    .obligationNumber(o.getObligationNumber() != null ? o.getObligationNumber() : num)
                    .name(deriveObligationName(o, num))
                    .description(o.getPlainEnglishStatement())
                    .sectionReference(o.getSpecificSectionReference())
                    .areaOfFocus(o.getAreaOfFocus())
                    .obligationType(o.getObligationType())
                    .recurringDeadlineType(o.getRecurringDeadlineType())
                    .effectiveDate(effDate)
                    .status("active")
                    .source("seeded")
                    .riskDescription(o.getRiskDescription())
                    .inherentLikelihood(o.getInherentLikelihood())
                    .inherentImpact(o.getInherentImpact())
                    .inherentRiskRating(o.getInherentRiskRating())
                    .controlOwner(o.getControlOwner())
                    .build();
                ob = obligationRepo.save(ob);
                ObligationClassification c = classifications.save(ObligationClassification.builder()
                    .instrumentId(instrumentId)
                    .obligationId(ob.getObligationId())
                    .applicability("applicable")
                    .status("active")
                    .classificationVersion(1)
                    .classifiedAt(Instant.now())
                    .impactRating(o.getInherentImpact())
                    .likelihoodRating(o.getInherentLikelihood())
                    .inherentRiskRating(o.getInherentRiskRating())
                    .tenantRiskRating(o.getInherentRiskRating())
                    .assignedOwnerName(o.getControlOwner())
                    .build());
                createdObligations.add(ob);
                createdClassifications.add(c);
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
        // Maps each obligation -> the control IDs created in this bundle that link to it.
        Map<Long, List<Integer>> controlsByObligation = new HashMap<>();
        if (bundle.getControls() != null) {
            for (PlatformRegulationSeed.ControlItem c : bundle.getControls()) {
                if (c.getControlNumber() == null || c.getControlNumber().isBlank()) continue;
                if (controlRepo.existsByControlNumber(c.getControlNumber())) continue;

                // Controls belong to the bundle's regulation, so they attach to ALL obligations of that
                // instrument (the toolkit links controls at the act_id/regulation level). This guarantees every
                // obligation carries its regulation's controls + additional controls.
                List<Long> linkedIds = createdObligations.isEmpty()
                    ? obligationRepo.findByInstrumentId(instrumentId).stream()
                        .map(Obligation::getObligationId)
                        .toList()
                    : createdObligations.stream()
                        .map(Obligation::getObligationId)
                        .toList();
                // Union in any platform-supplied explicit links (a subset of the same instrument).
                if (c.getLinkedObligationIds() != null && !c.getLinkedObligationIds().isBlank()) {
                    java.util.Set<Long> merged = new java.util.LinkedHashSet<>(linkedIds);
                    java.util.Arrays.stream(c.getLinkedObligationIds().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .forEach(s -> merged.add(Long.parseLong(s)));
                    linkedIds = new ArrayList<>(merged);
                }

                Control saved = controlRepo.save(Control.builder()
                    .controlNumber(c.getControlNumber())
                    .name(c.getComplianceControl() != null ? c.getComplianceControl() : c.getComplianceArea())
                    .description(c.getComplianceControl())
                    .theme(c.getTheme())
                    .controlType(c.getControlType() != null ? c.getControlType() : "CMP")
                    .whatItDoes(c.getMonitoringActivity())
                    .howTested(c.getComplianceControl())
                    .controlOwnerName(c.getResponsibleOfficer())
                    .ownerName(c.getOwnerName())
                    .testFrequency(c.getFrequency())
                    .inherentRisk(c.getRiskLevel())
                    .residualRisk(c.getRiskLevel())
                    .residualLikelihood(c.getResidualLikelihood())
                    .residualImpact(c.getResidualImpact())
                    .residualRiskRating(c.getResidualRiskRating())
                    .linkedObligationIds(linkedIds)
                    .regulatoryRequirement(c.getRegulatoryRequirement())
                    .complianceArea(c.getComplianceArea())
                    .monitoringActivity(c.getMonitoringActivity())
                    .dueDate(c.getDueDate())
                    .controlEffectivenessMeasure(c.getControlEffectivenessMeasure())
                    .actId(bundle.getRegulationId() != null ? bundle.getRegulationId().intValue() : null)
                    .actName(c.getActName() != null ? c.getActName() : bundle.getRegulationName())
                    .status("Active")
                    .build());
                seededControls++;
                for (Long oid : linkedIds) {
                    controlsByObligation.computeIfAbsent(oid, k -> new ArrayList<>()).add(saved.getControlId());
                }
            }
        }

        // Wire each obligation's classification to the controls that target it.
        for (ObligationClassification c : createdClassifications) {
            List<Integer> ids = controlsByObligation.get(c.getObligationId());
            if (ids != null && !ids.isEmpty()) {
                c.setLinkedControlIds(new ArrayList<>(ids));
                classifications.save(c);
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

    private String deriveObligationName(PlatformRegulationSeed.ObligationItem o, int num) {
        String base = o.getAreaOfFocus();
        if (base == null || base.isBlank()) base = o.getObligationType();
        if (base == null || base.isBlank()) base = o.getPlainEnglishStatement();
        if (base == null || base.isBlank()) base = "Obligation " + num;
        base = base.trim();
        if (base.length() > 120) base = base.substring(0, 117) + "...";
        return base;
    }

    private Integer parseDueDayFromFrequency(String frequency) {
        if (frequency == null || frequency.isBlank()) return 1;
        String f = frequency.trim().toLowerCase();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("on\\s+or\\s+before\\s+(?:the\\s+)?(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = java.util.regex.Pattern.compile("by\\s+\\w+\\s+(\\d+)(?:st|nd|rd|th)?").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = java.util.regex.Pattern.compile("by\\s+(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = java.util.regex.Pattern.compile("within\\s+(\\d+)\\s+days?\\s+after\\s+month").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = java.util.regex.Pattern.compile("(\\d+)(?:st|nd|rd|th)").matcher(f);
        if (m.find()) return Integer.parseInt(m.group(1));
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
        return frequency.length() <= 50 ? frequency.trim() : frequency.trim().substring(0, 50);
    }
}
