package com.atheris.compliance.tenant.backend.modules.risk.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(30)
@RequiredArgsConstructor
@Slf4j
public class RiskMatrixStartup implements ApplicationRunner {

    private final RiskMatrixService riskMatrixService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            riskMatrixService.loadThresholds();
            log.info("[RiskMatrix] band thresholds loaded");
        } catch (Throwable e) {
            log.warn("[RiskMatrix] could not load band thresholds: {}", e.getMessage());
        }
    }
}