package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminControlDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.ControlPoint;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

@Service @RequiredArgsConstructor
public class AdminControlService {

    private static final int SUMMARY_LENGTH = 220;

    private final ComplianceControlRepository controls;
    private final ObligationMappingRepository obligations;
    private final InstrumentRepository instruments;

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
            .points(c.getPoints() == null ? List.of() : c.getPoints())
            .controlType(c.getControlType())
            .residualLikelihood(c.getResidualLikelihood())
            .residualImpact(c.getResidualImpact())
            .residualRiskRating(c.getResidualRiskRating())
            .ownerName(c.getOwnerName())
            .obligationId(c.getObligationId())
            .linkedObligationIds(c.getLinkedObligationIds())
            .linkedObligations(resolveLinkedObligations(c))
            .createdAt(c.getCreatedAt())
            .build();
    }

    /**
     * The obligations a control traces to, resolved from both link styles (the {@code obligation_id}
     * FK and the CSV {@code linked_obligation_ids}). Obligation + instrument titles are batch-loaded
     * so this is a fixed number of queries regardless of how many obligations are linked.
     */
    private List<AdminControlDetailDto.LinkedObligation> resolveLinkedObligations(ComplianceControl c) {
        Set<Long> ids = new LinkedHashSet<>();
        if (c.getObligationId() != null) ids.add(c.getObligationId());
        if (c.getLinkedObligationIds() != null) {
            for (String part : c.getLinkedObligationIds().split(",")) {
                String t = part.trim();
                if (t.isEmpty()) continue;
                try { ids.add(Long.parseLong(t)); } catch (NumberFormatException ignored) { /* skip junk */ }
            }
        }
        if (ids.isEmpty()) return List.of();

        List<ObligationMapping> found = obligations.findAllById(ids);
        Map<Long, ObligationMapping> byId = new LinkedHashMap<>();
        found.forEach(o -> byId.put(o.getObligationId(), o));

        Set<Long> instrumentIds = new LinkedHashSet<>();
        found.stream().map(ObligationMapping::getInstrumentId).filter(Objects::nonNull).forEach(instrumentIds::add);
        Map<Long, Instrument> instById = new LinkedHashMap<>();
        if (!instrumentIds.isEmpty()) {
            for (Instrument i : instruments.findAllById(instrumentIds)) instById.put(i.getInstrumentId(), i);
        }

        List<AdminControlDetailDto.LinkedObligation> out = new ArrayList<>();
        for (Long id : ids) {
            ObligationMapping o = byId.get(id);
            if (o == null) continue;
            Instrument inst = o.getInstrumentId() != null ? instById.get(o.getInstrumentId()) : null;
            out.add(AdminControlDetailDto.LinkedObligation.builder()
                .obligationId(o.getObligationId())
                .title(o.getTitle())
                .description(o.getDescription())
                .instrumentTitle(inst != null ? inst.getSourceTitle() : null)
                .build());
        }
        return out;
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
            .controlPoints(pointTexts(c.getPoints()))
            .build();
    }

    /** The display text of each control point (`content`, falling back to `text`). */
    private List<String> pointTexts(List<ControlPoint> points) {
        if (points == null || points.isEmpty()) return List.of();
        return points.stream()
            .map(this::pointText)
            .filter(t -> t != null && !t.isBlank())
            .toList();
    }

    private String pointText(ControlPoint point) {
        if (point == null) return null;
        if (point.getContent() != null && !point.getContent().isBlank()) return point.getContent().trim();
        return point.getText() == null ? null : point.getText().trim();
    }

    private String summarise(String text) {
        if (text == null) return null;
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() <= SUMMARY_LENGTH ? flat : flat.substring(0, SUMMARY_LENGTH) + "...";
    }

    /** Maps entities to the register DTO — reused so an embedder (e.g. obligation detail) renders identical rows. */
    public List<AdminControlDto> toDtoList(List<ComplianceControl> controls) {
        return controls.stream().map(this::toDto).toList();
    }
}
