package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateSeedResult;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.entity.RunbookTemplate;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.repository.RunbookTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Seeds {@code runbook_templates} from the committed classpath file {@code runbooks/runbook_templates.json}
 * (a JSON array of portable runbooks). Idempotent: missing codes are inserted; when the canonical content hash
 * of an existing code changes, its content is replaced and {@code template_version} is bumped (and written back
 * into {@code content.templateVersion}). The hash excludes {@code templateVersion} so the write-back is stable.
 */
@Service @Slf4j
public class RunbookTemplateSeedService {

    public static final String RESOURCE = "runbooks/runbook_templates.json";
    static final String FORMAT = "atheris-runbook/1";

    static final Set<String> CATEGORIES = Set.of("ACCESS_REVIEW", "VULN_MGMT", "INCIDENT", "CONFIG_AUDIT", "CRYPTO",
        "BCP_DR", "PRIVACY", "AML", "RETURNS", "VENDOR", "CHANGE", "LOGGING", "CUSTOM");
    static final Set<String> CRITICALITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    static final Set<String> FREQUENCIES = Set.of("ON_DEMAND", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY",
        "SEMI_ANNUAL", "ANNUAL", "EVENT_DRIVEN");

    private final RunbookTemplateRepository templates;
    private final ObjectMapper reader;
    private final ObjectMapper canonical;

    @PersistenceContext private EntityManager em;

    public RunbookTemplateSeedService(RunbookTemplateRepository templates, ObjectMapper objectMapper) {
        this.templates = templates;
        this.reader = objectMapper;
        this.canonical = objectMapper.copy()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .configure(SerializationFeature.INDENT_OUTPUT, false);
    }

    /** Reads the classpath seed file and upserts it. Returns {@code null} when the resource is absent. */
    public RunbookTemplateSeedResult seedFromClasspath() throws Exception {
        Resource resource = new ClassPathResource(RESOURCE);
        if (!resource.exists()) return null;
        List<Map<String, Object>> docs;
        try (InputStream in = resource.getInputStream()) {
            docs = reader.readValue(in, new TypeReference<List<Map<String, Object>>>() {});
        }
        return seed(docs);
    }

    @Transactional
    public RunbookTemplateSeedResult seed(List<Map<String, Object>> docs) {
        try {
            RunbookTemplateSeedResult result = RunbookTemplateSeedResult.builder().read(docs.size()).build();
            Set<String> codes = docs.stream().map(d -> RunbookContent.str(d, "templateCode"))
                .filter(c -> c != null).collect(Collectors.toSet());
            // One query for every existing row — no per-template lookup.
            Map<String, RunbookTemplate> existing = templates.findByTemplateCodeIn(codes).stream()
                .collect(Collectors.toMap(RunbookTemplate::getTemplateCode, Function.identity()));
            Set<String> seen = new HashSet<>();

            for (Map<String, Object> doc : docs) {
                String problem = validate(doc);
                String code = RunbookContent.str(doc, "templateCode");
                if (problem == null && !seen.add(code)) problem = "duplicate templateCode in seed file";
                if (problem != null) {
                    log.warn("[RunbookTemplateSeed] skipping template {}: {}", code, problem);
                    result.setSkipped(result.getSkipped() + 1);
                    continue;
                }
                String hash = contentHash(doc);
                RunbookTemplate row = existing.get(code);
                if (row == null) {
                    int version = positiveOr(RunbookContent.integer(doc, "templateVersion"), 1);
                    row = RunbookTemplate.builder()
                        .templateCode(code)
                        .templateVersion(version)
                        .contentHash(hash)
                        .status(RunbookTemplate.STATUS_PUBLISHED)
                        .build();
                    apply(row, doc, version);
                    templates.save(row);
                    result.setInserted(result.getInserted() + 1);
                } else if (!hash.equals(row.getContentHash())) {
                    int version = (row.getTemplateVersion() == null ? 1 : row.getTemplateVersion()) + 1;
                    row.setTemplateVersion(version);
                    row.setContentHash(hash);
                    row.setPublishedAt(Instant.now());
                    row.setUpdatedAt(Instant.now());
                    apply(row, doc, version);
                    templates.save(row);
                    result.setUpdated(result.getUpdated() + 1);
                } else {
                    result.setUnchanged(result.getUnchanged() + 1);
                }
            }
            return result;
        } catch (Throwable e) {
            log.error("[RunbookTemplateSeed] seed failed: {}", e.getMessage(), e);
            try { em.clear(); } catch (Throwable ignored) { /* best effort */ }
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) { /* best effort */ }
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    /** SHA-256 of the canonical (key-sorted, compact) JSON of the content minus {@code templateVersion}. */
    String contentHash(Map<String, Object> doc) throws Exception {
        Map<String, Object> copy = new LinkedHashMap<>(doc);
        copy.remove("templateVersion");
        byte[] json = canonical.writeValueAsString(copy).getBytes(StandardCharsets.UTF_8);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json));
    }

    private void apply(RunbookTemplate row, Map<String, Object> doc, int version) {
        Map<String, Object> content = new LinkedHashMap<>(doc);
        content.putIfAbsent("format", FORMAT);
        content.put("templateVersion", version);
        row.setTitle(RunbookContent.str(doc, "title"));
        row.setCategory(RunbookContent.str(doc, "category"));
        row.setCriticality(RunbookContent.str(doc, "criticality"));
        row.setFrequency(RunbookContent.str(doc, "frequency"));
        row.setSlaMinutes(RunbookContent.integer(doc, "slaMinutes"));
        row.setObjective(RunbookContent.str(doc, "objective"));
        row.setSectionCount(RunbookContent.sectionCount(doc));
        row.setStepCount(RunbookContent.stepCount(doc));
        row.setContent(content);
    }

    private String validate(Map<String, Object> doc) {
        String code = RunbookContent.str(doc, "templateCode");
        if (code == null) return "templateCode is required";
        if (code.length() > 50) return "templateCode longer than 50 characters";
        String title = RunbookContent.str(doc, "title");
        if (title == null) return "title is required";
        if (title.length() > 500) return "title longer than 500 characters";
        String format = RunbookContent.str(doc, "format");
        if (format != null && !FORMAT.equals(format)) return "unsupported format " + format;
        if (!CATEGORIES.contains(RunbookContent.str(doc, "category"))) return "invalid category";
        if (!CRITICALITIES.contains(RunbookContent.str(doc, "criticality"))) return "invalid criticality";
        String frequency = RunbookContent.str(doc, "frequency");
        if (frequency != null && !FREQUENCIES.contains(frequency)) return "invalid frequency";
        if (RunbookContent.stepCount(doc) == 0) return "no steps";
        return null;
    }

    private static int positiveOr(Integer v, int fallback) {
        return v == null || v < 1 ? fallback : v;
    }
}
