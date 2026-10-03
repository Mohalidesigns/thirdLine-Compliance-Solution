package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

@Service @RequiredArgsConstructor
public class AdminControlService {

    private static final int SUMMARY_LENGTH = 220;

    private final ComplianceControlRepository controls;

    public Page<AdminControlDto> list(String q, Long actId, String theme, String complianceArea,
                                      String riskLevel, String status, Pageable pageable) {
        return controls.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("controlNumber")), like),
                    cb.like(cb.lower(root.get("complianceControl")), like),
                    cb.like(cb.lower(root.get("regulatoryRequirement")), like)
                ));
            }
            if (actId != null) predicates.add(cb.equal(root.get("actId"), actId));
            if (theme != null && !theme.isBlank()) predicates.add(cb.equal(root.get("theme"), theme));
            if (complianceArea != null && !complianceArea.isBlank())
                predicates.add(cb.equal(root.get("complianceArea"), complianceArea));
            if (riskLevel != null && !riskLevel.isBlank()) predicates.add(cb.equal(root.get("riskLevel"), riskLevel));
            if (status != null && !status.isBlank()) predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable).map(this::toDto);
    }

    public AdminControlDetailDto detail(Long id) {
        ComplianceControl c = controls.findById(id)
            .orElseThrow(() -> new RuntimeException("Compliance control not found: " + id));
        return AdminControlDetailDto.builder()
            .complianceControlId(c.getComplianceControlId())
            .controlNumber(c.getControlNumber())
            .theme(c.getTheme())
            .complianceArea(c.getComplianceArea())
            .riskLevel(c.getRiskLevel())
            .frequency(c.getFrequency())
            .responsibleOfficer(c.getResponsibleOfficer())
            .dueDate(c.getDueDate())
            .status(c.getStatus())
            .actId(c.getActId())
            .actName(c.getActName())
            .complianceControl(c.getComplianceControl())
            .regulatoryRequirement(c.getRegulatoryRequirement())
            .monitoringActivity(c.getMonitoringActivity())
            .controlEffectivenessMeasure(c.getControlEffectivenessMeasure())
            .build();
    }

    public Map<String, Object> stats() {
        List<ComplianceControl> all = controls.findAll();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalControls", all.size());
        out.put("byRiskLevel", countBy(all, ComplianceControl::getRiskLevel));
        out.put("byStatus", countBy(all, ComplianceControl::getStatus));
        out.put("byTheme", countBy(all, ComplianceControl::getTheme));
        out.put("themes", distinct(all, ComplianceControl::getTheme));
        out.put("riskLevels", distinct(all, ComplianceControl::getRiskLevel));
        out.put("statuses", distinct(all, ComplianceControl::getStatus));
        out.put("complianceAreas", distinct(all, ComplianceControl::getComplianceArea));
        return out;
    }

    private Map<String, Long> countBy(List<ComplianceControl> all,
                                      java.util.function.Function<ComplianceControl, String> field) {
        Map<String, Long> counts = new TreeMap<>();
        for (ComplianceControl c : all) {
            String key = field.apply(c);
            if (key == null || key.isBlank()) key = "Unspecified";
            counts.merge(key, 1L, Long::sum);
        }
        return counts;
    }

    private List<String> distinct(List<ComplianceControl> all,
                                  java.util.function.Function<ComplianceControl, String> field) {
        return all.stream()
            .map(field)
            .filter(Objects::nonNull)
            .filter(v -> !v.isBlank())
            .distinct()
            .sorted()
            .toList();
    }

    private AdminControlDto toDto(ComplianceControl c) {
        return AdminControlDto.builder()
            .complianceControlId(c.getComplianceControlId())
            .controlNumber(c.getControlNumber())
            .theme(c.getTheme())
            .complianceArea(c.getComplianceArea())
            .riskLevel(c.getRiskLevel())
            .frequency(c.getFrequency())
            .responsibleOfficer(c.getResponsibleOfficer())
            .dueDate(c.getDueDate())
            .status(c.getStatus())
            .actId(c.getActId())
            .actName(c.getActName())
            .controlSummary(summarise(c.getComplianceControl()))
            .build();
    }

    private String summarise(String text) {
        if (text == null) return null;
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() <= SUMMARY_LENGTH ? flat : flat.substring(0, SUMMARY_LENGTH) + "...";
    }
}
