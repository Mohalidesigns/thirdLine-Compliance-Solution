package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
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

    @Value("${atheris.tenant-id:1}")
    private Long tenantId;

    @Transactional
    public int seedAll() {
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

        if (obligationRepo.countByInstrumentId(instrumentId) > 0) {
            log.info("Seed skip: instrument {} already has obligations", instrumentId);
            return 0;
        }
        TenantRegulator reg = tenantRegs.stream()
            .filter(r -> bundle.getRegulatorId() != null
                && bundle.getRegulatorId().equals(r.getPlatformRegulatorId()))
            .findFirst().orElse(null);

        LocalDate effDate = bundle.getCanonicalInstrument().getDateCommencement() != null
            ? bundle.getCanonicalInstrument().getDateCommencement()
            : bundle.getCanonicalInstrument().getDateIssued();

        List<Obligation> createdObligations = new ArrayList<>();
        if (bundle.getObligations() != null) {
            int num = 1;
            for (PlatformRegulationSeed.ObligationItem o : bundle.getObligations()) {
                Obligation ob = Obligation.builder()
                    .instrumentId(instrumentId)
                    .obligationNumber(o.getObligationNumber() != null ? o.getObligationNumber() : num)
                    .description(o.getPlainEnglishStatement())
                    .sectionReference(o.getSpecificSectionReference())
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
                String label = r.getRecipient() != null && !r.getRecipient().isBlank()
                    ? r.getRecipient()
                    : (reg != null ? (reg.getAbbreviation() != null ? reg.getAbbreviation() : reg.getName()) : null);
                RegulatoryReturn rt = returns.save(RegulatoryReturn.builder()
                    .returnName(r.getTitle())
                    .filingRegulator(label)
                    .tenantRegulatorId(regId)
                    .frequency(normalizeFrequency(r.getFrequency()))
                    .status(com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus.ACTIVE)
                    .build());
                if (createdObligations != null) {
                    for (Obligation ob : createdObligations) {
                        obligationRepo.insertReturnLink(ob.getObligationId(), rt.getReturnId());
                    }
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

        log.info("Seeded instrument {} ({}): {} obligations, {} sanctions, returns {}",
            instrumentId, bundle.getRegulationName(),
            createdObligations.size(),
            bundle.getSanctions() != null ? bundle.getSanctions().size() : 0,
            bundle.getReturns() != null ? bundle.getReturns().size() : 0);
        return createdObligations.size();
    }

    private String normalizeFrequency(String frequency) {
        if (frequency == null || frequency.isBlank()) return null;
        String f = frequency.trim();
        if (f.length() <= 50) return f;
        String lower = f.toLowerCase();
        String[] tokens = lower.split("[\\s:;,–-]+");
        if (tokens.length > 0) {
            String head = tokens[0];
            if ("quarterly".equals(head) || "monthly".equals(head) || "annually".equals(head)
                || "semi".equals(head) || "weekly".equals(head) || "daily".equals(head)
                || "within".equals(head) || "not".equals(head) || "as".equals(head)
                || "on".equals(head) || "at".equals(head)) {
                String keyword = "semi".equals(head) && tokens.length > 1 ? head + "-" + tokens[1] : head;
                return keyword.substring(0, Math.min(50, keyword.length()));
            }
        }
        return f.substring(0, 50);
    }
}