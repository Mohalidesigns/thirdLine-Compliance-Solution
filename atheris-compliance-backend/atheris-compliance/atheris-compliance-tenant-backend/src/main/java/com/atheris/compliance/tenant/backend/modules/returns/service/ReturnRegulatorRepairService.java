package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The regulation seed used to write a return's responsible unit (e.g. "Trade & Exchange /
 * Financial Markets Department") into {@code filingRegulator}, so the returns register, the
 * rendition tracker and the escalation matrix showed a department as the regulator. This repair
 * (idempotent, runs once per start) sets the regulator back on those rows only: a return whose
 * {@code filingRegulator} is blank, or still equals its responsible unit while differing from its
 * linked regulator. Returns a user created or edited with a real regulator name are left alone.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReturnRegulatorRepairService {

    private final RegulatoryReturnRepository returns;
    private final TenantRegulatorRepository tenantRegulators;
    private final PlatformTransactionManager txManager;

    private final AtomicBoolean done = new AtomicBoolean(false);

    /** Regulator abbreviation, else its name; null when the return has no linked regulator. */
    public static String regulatorLabel(TenantRegulator reg) {
        if (reg == null) return null;
        if (reg.getAbbreviation() != null && !reg.getAbbreviation().isBlank()) return reg.getAbbreviation();
        return reg.getName();
    }

    @Scheduled(initialDelay = 45_000, fixedDelay = 600_000)
    public void repairOnce() {
        if (done.get()) return;
        try {
            Integer fixed = new TransactionTemplate(txManager).execute(status -> repair());
            if (fixed != null && fixed > 0) log.info("[ReturnRegulatorRepair] regulator restored on {} returns", fixed);
            done.set(true);
        } catch (Throwable e) {
            log.warn("[ReturnRegulatorRepair] skipped this run: {}", e.getMessage());
        }
    }

    int repair() {
        List<RegulatoryReturn> linked = returns.findByTenantRegulatorIdIsNotNull();
        if (linked.isEmpty()) return 0;
        Set<Long> regIds = linked.stream().map(RegulatoryReturn::getTenantRegulatorId).collect(Collectors.toSet());
        Map<Long, TenantRegulator> regs = tenantRegulators.findAllById(regIds).stream()
            .collect(Collectors.toMap(TenantRegulator::getId, Function.identity()));
        List<RegulatoryReturn> changed = new ArrayList<>();
        for (RegulatoryReturn r : linked) {
            if (apply(r, regs.get(r.getTenantRegulatorId()))) changed.add(r);
        }
        if (!changed.isEmpty()) returns.saveAll(changed);
        return changed.size();
    }

    /** Pure: fixes one row in place; true when it changed. */
    static boolean apply(RegulatoryReturn r, TenantRegulator reg) {
        String label = regulatorLabel(reg);
        if (label == null || label.isBlank()) return false;
        String current = r.getFilingRegulator();
        if (label.equals(current)) return false;
        boolean blank = current == null || current.isBlank();
        boolean isUnitCopy = !blank && r.getResponsibleUnit() != null && current.equals(r.getResponsibleUnit())
            && reg.getName() != null && !current.equalsIgnoreCase(reg.getName());
        if (!blank && !isUnitCopy) return false;
        r.setFilingRegulator(label);
        return true;
    }
}
