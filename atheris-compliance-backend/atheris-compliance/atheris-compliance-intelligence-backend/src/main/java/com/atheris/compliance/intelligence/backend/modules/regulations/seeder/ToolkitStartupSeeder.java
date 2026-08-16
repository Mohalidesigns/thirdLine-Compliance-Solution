package com.atheris.compliance.intelligence.backend.modules.regulations.seeder;

import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.service.ToolkitImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Auto-loads the Nigerian Compliance Toolkit (packaged as a classpath resource) on startup so
 * the intelligence backend always has the regulator/regulation/obligation/sanction/return universe
 * available for tenant seeding — no manual POST /admin/regulations/toolkit/import needed.
 *
 * The import is idempotent and atomic, so it is only invoked when the toolkit has not yet been
 * seeded (regulations table empty), avoiding re-parsing the ~3.5 MB file on every boot.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(1)
public class ToolkitStartupSeeder implements ApplicationRunner {

    private final RegulationRepository regulations;
    private final ToolkitImportService toolkitImport;

    @Override
    public void run(ApplicationArguments args) {
        if (regulations.count() > 0) {
            log.info("[ToolkitSeeder] Regulations already present ({}), skipping auto-import", regulations.count());
            return;
        }
        try {
            Map<String, Object> result = toolkitImport.importToolkit();
            log.info("[ToolkitSeeder] Compliance toolkit auto-imported on startup: {}",
                result.get("error") != null ? "ERROR " + result.get("error") : result);
        } catch (Exception e) {
            log.error("[ToolkitSeeder] Compliance toolkit auto-import failed: {}", e.getMessage(), e);
        }
    }
}
