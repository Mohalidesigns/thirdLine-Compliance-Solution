package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.seeder;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateSeedResult;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service.RunbookTemplateSeedService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Upserts the runbook template library on every start. Never blocks startup. */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(2) // after AdminUserSeeder (0) and ToolkitStartupSeeder (1)
public class RunbookTemplateStartupSeeder implements ApplicationRunner {

    private final RunbookTemplateSeedService seedService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            RunbookTemplateSeedResult result = seedService.seedFromClasspath();
            if (result == null) {
                log.warn("[RunbookTemplateSeed] classpath:{} not found, skipping", RunbookTemplateSeedService.RESOURCE);
            } else {
                log.info("[RunbookTemplateSeed] {}", result);
            }
        } catch (Throwable e) {
            log.error("[RunbookTemplateSeed] runbook template seed failed: {}", e.getMessage(), e);
        }
    }
}
