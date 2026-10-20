package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The one writer of control ↔ obligation links. A link is stored twice — on the control
 * ({@code controls.linked_obligation_ids}, control detail and its filter) and on the obligation's
 * classification ({@code linked_control_ids}, the register's "N controls", "No Control" and every
 * coverage figure) — so every change goes through here and updates both sides.
 */
@Service
@RequiredArgsConstructor
public class ControlLinkService {

    private final ControlRepository controls;
    private final ObligationRepository obligations;
    private final ObligationClassificationRepository classifications;

    /** Replaces the obligations a (saved) control covers; unknown obligation ids are rejected. */
    @Transactional
    public void setObligationsOfControl(Control control, Collection<Long> obligationIds) {
        Set<Long> wanted = obligationIds == null ? new LinkedHashSet<>() : new LinkedHashSet<>(obligationIds);
        wanted.remove(null);
        Map<Long, Obligation> found = obligations.findAllById(wanted).stream()
            .collect(Collectors.toMap(Obligation::getObligationId, Function.identity()));
        List<Long> unknown = wanted.stream().filter(id -> !found.containsKey(id)).toList();
        if (!unknown.isEmpty()) throw ApiException.badRequest("unknown_obligations", "Obligations not found: " + unknown);

        Set<Long> before = control.getLinkedObligationIds() == null ? Set.of() : new HashSet<>(control.getLinkedObligationIds());
        control.setLinkedObligationIds(new ArrayList<>(wanted));
        controls.save(control);

        Set<Long> affected = new HashSet<>(before);
        affected.addAll(wanted);
        if (affected.isEmpty()) return;
        Map<Long, ObligationClassification> byObligation = classifications.findByObligationIdIn(affected).stream()
            .collect(Collectors.toMap(ObligationClassification::getObligationId, Function.identity(), (a, b) -> a));
        List<ObligationClassification> toSave = new ArrayList<>();
        for (Long obligationId : affected) {
            ObligationClassification c = byObligation.get(obligationId);
            boolean link = wanted.contains(obligationId);
            if (c == null) {
                if (!link) continue;
                c = newClassification(found.get(obligationId));
            }
            List<Integer> ids = c.getLinkedControlIds() == null ? new ArrayList<>() : new ArrayList<>(c.getLinkedControlIds());
            boolean changed = link ? addIfAbsent(ids, control.getControlId()) : ids.remove(control.getControlId());
            if (changed || c.getClassificationId() == null) {
                c.setLinkedControlIds(ids);
                toSave.add(c);
            }
        }
        classifications.saveAll(toSave);
    }

    /** Replaces the controls covering an obligation (saves the classification); unknown control ids are rejected. */
    @Transactional
    public ObligationClassification setControlsOfObligation(ObligationClassification classification, Collection<Integer> controlIds) {
        Set<Integer> wanted = controlIds == null ? new LinkedHashSet<>() : new LinkedHashSet<>(controlIds);
        wanted.remove(null);
        Map<Integer, Control> found = controls.findAllById(wanted).stream()
            .collect(Collectors.toMap(Control::getControlId, Function.identity()));
        List<Integer> unknown = wanted.stream().filter(id -> !found.containsKey(id)).toList();
        if (!unknown.isEmpty()) throw ApiException.badRequest("unknown_controls", "Controls not found: " + unknown);

        Set<Integer> before = classification.getLinkedControlIds() == null ? Set.of() : new HashSet<>(classification.getLinkedControlIds());
        classification.setLinkedControlIds(new ArrayList<>(wanted));
        ObligationClassification saved = classifications.save(classification);

        Long obligationId = saved.getObligationId();
        Set<Integer> removed = new HashSet<>(before);
        removed.removeAll(wanted);
        List<Control> touched = new ArrayList<>(found.values());
        touched.addAll(controls.findAllById(removed));
        List<Control> toSave = new ArrayList<>();
        for (Control ctl : touched) {
            List<Long> ids = ctl.getLinkedObligationIds() == null ? new ArrayList<>() : new ArrayList<>(ctl.getLinkedObligationIds());
            boolean changed = wanted.contains(ctl.getControlId()) ? addIfAbsent(ids, obligationId) : ids.remove(obligationId);
            if (changed) {
                ctl.setLinkedObligationIds(ids);
                toSave.add(ctl);
            }
        }
        controls.saveAll(toSave);
        return saved;
    }

    private static <T> boolean addIfAbsent(List<T> list, T value) {
        if (list.contains(value)) return false;
        list.add(value);
        return true;
    }

    private static ObligationClassification newClassification(Obligation ob) {
        return ObligationClassification.builder()
            .instrumentId(ob != null ? ob.getInstrumentId() : null)
            .obligationId(ob != null ? ob.getObligationId() : null)
            .applicability("applicable")
            .status("active")
            .classificationVersion(1)
            .classifiedAt(Instant.now())
            .build();
    }
}
