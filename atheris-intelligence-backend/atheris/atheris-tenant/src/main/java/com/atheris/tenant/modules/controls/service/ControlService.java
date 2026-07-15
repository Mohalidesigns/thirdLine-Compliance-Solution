package com.atheris.tenant.modules.controls.service;

import com.atheris.tenant.modules.audit.service.AuditService;
import com.atheris.tenant.modules.controls.dto.*;
import com.atheris.tenant.modules.controls.entity.Control;
import com.atheris.tenant.modules.controls.repository.ControlRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ControlService {

    private final ControlRepository repo;
    private final AuditService audit;

    public List<ControlDto> findAll() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    public List<ControlDto> findByTheme(String theme) {
        return repo.findByTheme(theme).stream().map(this::toDto).toList();
    }

    public List<ControlDto> findByOwner(Integer uid) {
        return repo.findActiveByOwner(uid).stream().map(this::toDto).toList();
    }

    public List<ControlDto> findHighRisk() {
        return repo.findHighResidualRisk().stream().map(this::toDto).toList();
    }

    public ControlDto findById(Integer id) {
        return toDto(repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Control not found: " + id)));
    }

    @Transactional
    public ControlDto create(CreateControlRequest req, Integer userId) {
        if (repo.existsByControlNumber(req.getControlNumber()))
            throw new RuntimeException("Control number already exists");
        Control c = Control.builder()
            .controlNumber(req.getControlNumber()).name(req.getName())
            .description(req.getDescription()).theme(req.getTheme())
            .controlType(req.getControlType()).whatItDoes(req.getWhatItDoes())
            .howTested(req.getHowTested()).controlOwnerUserId(req.getControlOwnerUserId())
            .testFrequency(req.getTestFrequency()).testFrequencyDays(req.getTestFrequencyDays())
            .linkedObligationIds(req.getLinkedObligationIds())
            .inherentRisk(req.getInherentRisk()).residualRisk(req.getInherentRisk())
            .status("Active").createdByUserId(userId).build();
        Control saved = repo.save(c);
        audit.log(userId, "control_created", "control", saved.getControlId().longValue(),
            Map.of("control_number", saved.getControlNumber()));
        return toDto(saved);
    }

    @Transactional
    public ControlDto update(Integer id, CreateControlRequest req, Integer userId) {
        Control c = repo.findById(id).orElseThrow();
        if (req.getName() != null) c.setName(req.getName());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getWhatItDoes() != null) c.setWhatItDoes(req.getWhatItDoes());
        if (req.getHowTested() != null) c.setHowTested(req.getHowTested());
        if (req.getControlOwnerUserId() != null) c.setControlOwnerUserId(req.getControlOwnerUserId());
        if (req.getTestFrequency() != null) c.setTestFrequency(req.getTestFrequency());
        if (req.getTestFrequencyDays() != null) c.setTestFrequencyDays(req.getTestFrequencyDays());
        if (req.getLinkedObligationIds() != null) c.setLinkedObligationIds(req.getLinkedObligationIds());
        if (req.getInherentRisk() != null) c.setInherentRisk(req.getInherentRisk());
        audit.log(userId, "control_updated", "control", id.longValue(), Map.of());
        return toDto(repo.save(c));
    }

    private ControlDto toDto(Control c) {
        return ControlDto.builder()
            .controlId(c.getControlId()).controlNumber(c.getControlNumber()).name(c.getName())
            .description(c.getDescription()).theme(c.getTheme()).controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes()).howTested(c.getHowTested())
            .controlOwnerUserId(c.getControlOwnerUserId()).controlOwnerName(c.getControlOwnerName())
            .testFrequency(c.getTestFrequency()).testFrequencyDays(c.getTestFrequencyDays())
            .linkedObligationIds(c.getLinkedObligationIds())
            .inherentRisk(c.getInherentRisk()).residualRisk(c.getResidualRisk())
            .status(c.getStatus()).createdAt(c.getCreatedAt()).updatedAt(c.getUpdatedAt()).build();
    }
}
