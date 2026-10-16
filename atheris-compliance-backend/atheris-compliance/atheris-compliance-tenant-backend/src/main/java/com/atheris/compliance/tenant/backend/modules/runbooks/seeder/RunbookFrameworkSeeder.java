package com.atheris.compliance.tenant.backend.modules.runbooks.seeder;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookFramework;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookFrameworkClause;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookFrameworkClauseRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookFrameworkRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Seeds the regulatory framework library (CBN RBCSF, NDPA, ISO 27001, PCI DSS, NIST …) from
 * classpath {@code runbooks/runbook_frameworks.json}. Idempotent: inserts missing frameworks and
 * clauses only — it never overwrites or deletes, so tenant mappings stay valid.
 */
@Component
@Order(20)
@Slf4j
@RequiredArgsConstructor
public class RunbookFrameworkSeeder implements ApplicationRunner {

    private static final String RESOURCE = "runbooks/runbook_frameworks.json";

    private final RunbookFrameworkRepository frameworks;
    private final RunbookFrameworkClauseRepository clauses;
    private final ObjectMapper mapper;

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            ClassPathResource res = new ClassPathResource(RESOURCE);
            if (!res.exists()) {
                log.warn("Runbook framework seed {} not found — skipping", RESOURCE);
                return;
            }
            Map<String, Object> doc;
            try (InputStream in = res.getInputStream()) {
                doc = mapper.readValue(in, new TypeReference<>() {});
            }
            int newFw = 0, newClauses = 0;
            Map<String, RunbookFramework> byCode = frameworks.findAll().stream()
                .collect(Collectors.toMap(RunbookFramework::getCode, f -> f));
            Object rawFw = doc.get("frameworks");
            for (Object fo : rawFw instanceof List<?> fl ? fl : List.of()) {
                Map<?, ?> f = (Map<?, ?>) fo;
                String code = str(f.get("code"));
                if (code == null) continue;
                RunbookFramework fw = byCode.get(code);
                if (fw == null) {
                    fw = frameworks.save(RunbookFramework.builder().code(code).name(str(f.get("name")))
                        .issuer(str(f.get("issuer"))).jurisdiction(Optional.ofNullable(str(f.get("jurisdiction"))).orElse("NG"))
                        .versionLabel(str(f.get("versionLabel"))).sourceUrl(str(f.get("sourceUrl"))).isInternal(false).build());
                    byCode.put(code, fw);
                    newFw++;
                }
                Set<String> existing = clauses.findByFrameworkIdOrderByClauseRefAsc(fw.getFrameworkId()).stream()
                    .map(RunbookFrameworkClause::getClauseRef).collect(Collectors.toSet());
                Object rawClauses = f.get("clauses");
                for (Object co : rawClauses instanceof List<?> cl ? cl : List.of()) {
                    Map<?, ?> c = (Map<?, ?>) co;
                    String ref = str(c.get("clauseRef"));
                    if (ref == null || !existing.add(ref)) continue;
                    clauses.save(RunbookFrameworkClause.builder().frameworkId(fw.getFrameworkId()).clauseRef(ref)
                        .title(str(c.get("title"))).requirementText(str(c.get("requirementText"))).domain(str(c.get("domain")))
                        .deadlineRule(str(c.get("deadlineRule")))
                        .slaMinutes(c.get("slaMinutes") instanceof Number n ? n.intValue() : null).build());
                    newClauses++;
                }
            }
            if (newFw > 0 || newClauses > 0) {
                log.info("Runbook framework library seeded: {} framework(s), {} clause(s) added", newFw, newClauses);
            }
        } catch (Throwable e) {
            log.error("Runbook framework seed failed (startup continues): {}", e.getMessage(), e);
            try { em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
