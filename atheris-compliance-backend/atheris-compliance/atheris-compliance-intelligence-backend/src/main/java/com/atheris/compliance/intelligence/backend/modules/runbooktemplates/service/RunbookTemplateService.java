package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateDto;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto.RunbookTemplateStatsDto;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.entity.RunbookTemplate;
import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.repository.RunbookTemplateRepository;
import com.atheris.compliance.intelligence.backend.shared.exception.ResourceNotFoundException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;

/** Read side of the runbook template library: tenant-facing internal API + admin explorer. */
@Service @RequiredArgsConstructor
@Transactional(readOnly = true)
public class RunbookTemplateService {

    private final RunbookTemplateRepository templates;

    // ── internal (tenant pull) ────────────────────────────────────────────

    public List<RunbookTemplateDto> listPublished() {
        return templates.findByStatusOrderByTemplateCodeAsc(RunbookTemplate.STATUS_PUBLISHED)
            .stream().map(t -> toDto(t, false)).toList();
    }

    public RunbookTemplateDto getPublished(String code) {
        RunbookTemplate t = templates.findByTemplateCodeAndStatus(code, RunbookTemplate.STATUS_PUBLISHED)
            .orElseThrow(() -> notFound(code));
        return toDto(t, true);
    }

    // ── admin explorer ────────────────────────────────────────────────────

    public Page<RunbookTemplateDto> list(String q, String category, String criticality, String status,
                                         Pageable pageable) {
        Specification<RunbookTemplate> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("templateCode")), like),
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("objective")), like)
                ));
            }
            if (category != null && !category.isBlank()) predicates.add(cb.equal(root.get("category"), category));
            if (criticality != null && !criticality.isBlank())
                predicates.add(cb.equal(root.get("criticality"), criticality));
            if (status != null && !status.isBlank()) predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return templates.findAll(spec, pageable).map(t -> toDto(t, false));
    }

    public RunbookTemplateStatsDto stats() {
        // The library is a few dozen rows; one query and in-memory grouping is cheaper than four.
        List<RunbookTemplate> all = templates.findAll();
        return RunbookTemplateStatsDto.builder()
            .total(all.size())
            .totalSteps(all.stream().mapToLong(t -> t.getStepCount() == null ? 0 : t.getStepCount()).sum())
            .byCategory(countBy(all, RunbookTemplate::getCategory))
            .byCriticality(countBy(all, RunbookTemplate::getCriticality))
            .byStatus(countBy(all, RunbookTemplate::getStatus))
            .byCriticalityCategory(byCriticalityCategory(all))
            .stepsByCategory(stepsByCategory(all))
            .build();
    }

    public RunbookTemplateDto detail(String code) {
        return toDto(templates.findByTemplateCode(code).orElseThrow(() -> notFound(code)), true);
    }

    // ── mapping ───────────────────────────────────────────────────────────

    private RunbookTemplateDto toDto(RunbookTemplate t, boolean withContent) {
        return RunbookTemplateDto.builder()
            .templateId(t.getTemplateId())
            .templateCode(t.getTemplateCode())
            .templateVersion(t.getTemplateVersion())
            .title(t.getTitle())
            .category(t.getCategory())
            .criticality(t.getCriticality())
            .frequency(t.getFrequency())
            .slaMinutes(t.getSlaMinutes())
            .objective(t.getObjective())
            .stepCount(t.getStepCount())
            .sectionCount(t.getSectionCount())
            .clauseRefs(RunbookContent.clauseRefs(t.getContent()))
            .status(t.getStatus())
            .contentHash(t.getContentHash())
            .publishedAt(t.getPublishedAt())
            .createdAt(t.getCreatedAt())
            .updatedAt(t.getUpdatedAt())
            .content(withContent ? t.getContent() : null)
            .build();
    }

    private static Map<String, Long> countBy(List<RunbookTemplate> all, Function<RunbookTemplate, String> field) {
        Map<String, Long> counts = new TreeMap<>();
        for (RunbookTemplate t : all) {
            counts.merge(keyOf(field.apply(t)), 1L, Long::sum);
        }
        return counts;
    }

    private static Map<String, Map<String, Long>> byCriticalityCategory(List<RunbookTemplate> all) {
        Map<String, Map<String, Long>> out = new TreeMap<>();
        for (RunbookTemplate t : all) {
            out.computeIfAbsent(keyOf(t.getCriticality()), k -> new TreeMap<>())
                .merge(keyOf(t.getCategory()), 1L, Long::sum);
        }
        return out;
    }

    private static Map<String, Long> stepsByCategory(List<RunbookTemplate> all) {
        Map<String, Long> out = new TreeMap<>();
        for (RunbookTemplate t : all) {
            out.merge(keyOf(t.getCategory()), t.getStepCount() == null ? 0L : t.getStepCount().longValue(), Long::sum);
        }
        return out;
    }

    private static String keyOf(String v) {
        return v == null || v.isBlank() ? "UNSPECIFIED" : v;
    }

    private static ResourceNotFoundException notFound(String code) {
        return new ResourceNotFoundException("TEMPLATE_NOT_FOUND", "Runbook template not found: " + code);
    }
}
