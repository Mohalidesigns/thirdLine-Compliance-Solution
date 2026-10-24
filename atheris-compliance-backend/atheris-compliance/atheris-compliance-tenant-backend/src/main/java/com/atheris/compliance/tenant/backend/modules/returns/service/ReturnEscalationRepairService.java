package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturnStatus;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
@Order(21)
public class ReturnEscalationRepairService implements ApplicationRunner {

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final EscalationPolicyService escalationPolicyService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int repinned = 0;
            for (RegulatoryReturn r : returns.findByStatus(RegulatoryReturnStatus.ACTIVE)) {
                Long policyId = r.getEscalationPolicyId();
                if (policyId == null) {
                    policyId = escalationPolicyService
                        .defaultPolicy(EscalationConstants.SUBJECT_RETURN, r.getFrequencyType())
                        .map(p -> p.getPolicyId()).orElse(null);
                }
                if (policyId == null) continue;
                List<Long> ids = instances.findByReturnId(r.getReturnId()).stream()
                    .map(i -> i.getInstanceId()).toList();
                if (ids.isEmpty()) continue;
                repinned += escalationPolicyService
                    .refreshUntouchedFrozen(EscalationConstants.SUBJECT_RETURN, ids, policyId);
            }
            if (repinned > 0) log.info("[ReturnEscalationRepair] re-pinned {} filings to their return's policy", repinned);
        } catch (Throwable e) {
            log.error("[ReturnEscalationRepair] failed: {}", e.getMessage(), e);
        }
    }
}
