package com.atheris.compliance.intelligence.backend.modules.regulations.seeder;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed.ToolkitImportResult;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.ToolkitDataRepairService;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.ToolkitImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@Order(1)
public class ToolkitStartupSeeder implements ApplicationRunner {

    private final RegulationRepository regulations;
    private final ToolkitImportService toolkitImport;
    private final ToolkitDataRepairService toolkitRepair;

    @Override
    public void run(ApplicationArguments args) {
        if (regulations.count() > 0) {
            log.info("[ToolkitSeeder] Regulations already present ({}), skipping auto-import", regulations.count());
        } else {
            try {
                ToolkitImportResult result = toolkitImport.importToolkit();
                log.info("[ToolkitSeeder] Compliance toolkit auto-imported on startup: {}",
                    result.getError() != null ? "ERROR " + result.getError() : result);
            } catch (Exception e) {
                log.error("[ToolkitSeeder] Compliance toolkit auto-import failed: {}", e.getMessage(), e);
            }
        }
        // idempotent: aligns rows imported under older rules (risk bands, area of focus)
        toolkitRepair.repair();
    }
}
