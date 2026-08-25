package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.*;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ControlService {

    private final ControlRepository repo;
    private final ControlTestResultRepository testRepo;
    private final ControlTaskRepository taskRepo;
    private final ObligationRepository obligationRepo;
    private final OwnerRepository ownerRepo;
    private final AuditService audit;

    public Page<ControlRegisterItem> getRegisterList(
            String theme, String residualRisk, Integer ownerUserId, Integer ownerId, String status, String q, Pageable p) {
        var spec = ControlSpecification.withFilters(theme, residualRisk, ownerUserId, ownerId, status);
        Page<Control> page = repo.findAll(spec, p);
        Map<Integer, ControlTask> latestTasks = getLatestPendingTasks(
            page.getContent().stream().map(Control::getControlId).toList());
        List<ControlRegisterItem> items = page.getContent().stream()
            .map(c -> toRegisterItem(c, latestTasks.get(c.getControlId())))
            .toList();
        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            items = items.stream().filter(i ->
                (i.getName() != null && i.getName().toLowerCase().contains(ql)) ||
                (i.getControlNumber() != null && i.getControlNumber().toLowerCase().contains(ql)) ||
                (i.getControlOwnerName() != null && i.getControlOwnerName().toLowerCase().contains(ql))
            ).toList();
        }
        return new PageImpl<>(items, p, items.size());
    }

    public ControlStatsDto getStats() {
        List<Control> all = repo.findAll();
        LocalDate today = LocalDate.now();
        long active = all.stream().filter(c -> "Active".equals(c.getStatus())).count();
        long highRisk = all.stream().filter(c -> "High".equals(c.getResidualRisk())).count();
        long testsDue = all.stream().filter(c -> {
            ControlTask t = taskRepo.findTopByControlIdAndStatusOrderByDueDateAsc(c.getControlId(), "Pending");
            return t != null && !t.getDueDate().isAfter(today);
        }).count();
        List<String> themes = all.stream().map(Control::getTheme).filter(Objects::nonNull)
            .map(String::trim).filter(s -> !s.isBlank()).distinct().sorted().toList();
        List<String> owners = all.stream().map(Control::getControlOwnerName).filter(Objects::nonNull)
            .map(String::trim).filter(s -> !s.isBlank()).distinct().sorted().toList();
        return ControlStatsDto.builder()
            .total(all.size()).active(active).highRisk(highRisk).testsDue(testsDue)
            .themes(themes).owners(owners).build();
    }

    private Map<Integer, ControlTask> getLatestPendingTasks(List<Integer> ids) {
        List<ControlTask> tasks = taskRepo.findByControlIdInAndStatus(ids, "Pending");
        return tasks.stream().collect(Collectors.toMap(
            ControlTask::getControlId, t -> t, (a, b) -> a.getDueDate().isBefore(b.getDueDate()) ? a : b));
    }

    private ControlRegisterItem toRegisterItem(Control c, ControlTask nextTask) {
        return ControlRegisterItem.builder()
            .controlId(c.getControlId()).controlNumber(c.getControlNumber()).name(c.getName())
            .theme(c.getTheme()).controlOwnerName(c.getControlOwnerName())
            .residualRisk(c.getResidualRisk()).status(c.getStatus())
            .nextTestDueDate(nextTask != null ? nextTask.getDueDate() : null).build();
    }

    public ControlDetailResponse getDetail(Integer id) {
        Control c = repo.findById(id).orElseThrow(() -> new RuntimeException("Control not found: " + id));

        List<ControlDetailResponse.LinkedObligation> obligations = Collections.emptyList();
        if (c.getLinkedObligationIds() != null && !c.getLinkedObligationIds().isEmpty()) {
            obligations = c.getLinkedObligationIds().stream()
                .map(oid -> {
                    var o = obligationRepo.findById(oid).orElse(null);
                    if (o == null) return null;
                    return ControlDetailResponse.LinkedObligation.builder()
                        .obligationId(o.getObligationId()).description(o.getDescription())
                        .instrumentTitle("Instrument " + o.getInstrumentId()).build();
                })
                .filter(Objects::nonNull)
                .toList();
        }

        List<ControlDetailResponse.TestResultItem> tests = testRepo
            .findByControlIdOrderByTestDateDesc(id).stream()
            .map(t -> ControlDetailResponse.TestResultItem.builder()
                .testId(t.getTestId()).testDate(t.getTestDate())
                .testedByUserId(t.getTestedByUserId()).testedByName(t.getTestedByName())
                .result(t.getResult()).resultDescription(t.getResultDescription())
                .failureDetails(t.getFailureDetails()).failureSeverity(t.getFailureSeverity())
                .evidenceUrl(t.getEvidenceUrl()).remediationRequired(t.getRemediationRequired())
                .reviewStatus(t.getReviewStatus()).createdAt(t.getCreatedAt()).build())
            .toList();

        LocalDate nextTest = null;
        ControlTask task = taskRepo.findTopByControlIdAndStatusOrderByDueDateAsc(id, "Pending");
        if (task != null) nextTest = task.getDueDate();

        return ControlDetailResponse.builder()
            .controlId(c.getControlId()).controlNumber(c.getControlNumber()).name(c.getName())
            .description(c.getDescription()).theme(c.getTheme()).controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes()).howTested(c.getHowTested())
            .controlOwnerUserId(c.getControlOwnerUserId()).controlOwnerId(c.getControlOwnerId())
            .controlOwnerName(c.getControlOwnerName())
            .testFrequency(c.getTestFrequency()).testFrequencyDays(c.getTestFrequencyDays())
            .linkedObligations(obligations).inherentRisk(c.getInherentRisk())
            .residualRisk(c.getResidualRisk()).status(c.getStatus())
            .createdByUserId(c.getCreatedByUserId()).createdAt(c.getCreatedAt()).updatedAt(c.getUpdatedAt())
            .testHistory(tests).nextTestDueDate(nextTest).build();
    }

    public ControlDto findById(Integer id) {
        return toDto(repo.findById(id).orElseThrow(() -> new RuntimeException("Control not found: " + id)));
    }

    @Transactional
    public ControlDto create(CreateControlRequest req, Integer userId) {
        String controlNumber = req.getControlNumber();
        if (controlNumber == null || controlNumber.isBlank()) {
            controlNumber = nextControlNumber();
        }
        if (repo.existsByControlNumber(controlNumber))
            throw new IllegalArgumentException("Control number already exists");
        Control c = Control.builder()
            .controlNumber(controlNumber).name(req.getName())
            .description(req.getDescription()).theme(req.getTheme())
            .controlType(req.getControlType()).whatItDoes(req.getWhatItDoes())
            .howTested(req.getHowTested())
            .controlOwnerId(req.getControlOwnerId())
            .controlOwnerName(resolveOwnerName(req.getControlOwnerId()))
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
        if (req.getControlOwnerId() != null) {
            c.setControlOwnerId(req.getControlOwnerId());
            c.setControlOwnerName(resolveOwnerName(req.getControlOwnerId()));
        }
        if (req.getTestFrequency() != null) c.setTestFrequency(req.getTestFrequency());
        if (req.getTestFrequencyDays() != null) c.setTestFrequencyDays(req.getTestFrequencyDays());
        if (req.getLinkedObligationIds() != null) c.setLinkedObligationIds(req.getLinkedObligationIds());
        if (req.getInherentRisk() != null) {
            c.setInherentRisk(req.getInherentRisk());
            if (c.getResidualRisk() == null) c.setResidualRisk(req.getInherentRisk());
        }
        audit.log(userId, "control_updated", "control", id.longValue(), Map.of());
        return toDto(repo.save(c));
    }

    private String resolveOwnerName(Integer ownerId) {
        if (ownerId == null) return null;
        return ownerRepo.findById(ownerId)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + ownerId))
            .getFullName();
    }

    private String nextControlNumber() {
        long count = repo.count();
        String candidate;
        do {
            count++;
            candidate = String.format("CTL-%04d", count);
        } while (repo.existsByControlNumber(candidate));
        return candidate;
    }

    public List<ControlDto> findAll() {
        return repo.findByStatus("Active").stream().map(this::toDto).toList();
    }
    public List<ControlDto> findByTheme(String theme) {
        return repo.findByTheme(theme).stream().map(this::toDto).toList();
    }
    public List<ControlDto> findByOwner(Integer ownerId) {
        return repo.findByControlOwnerId(ownerId).stream().map(this::toDto).toList();
    }
    public List<ControlDto> findHighRisk() {
        return repo.findByResidualRisk("High").stream().map(this::toDto).toList();
    }

    private ControlDto toDto(Control c) {
        return ControlDto.builder()
            .controlId(c.getControlId()).controlNumber(c.getControlNumber()).name(c.getName())
            .description(c.getDescription()).theme(c.getTheme()).controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes()).howTested(c.getHowTested())
            .controlOwnerUserId(c.getControlOwnerUserId()).controlOwnerId(c.getControlOwnerId())
            .controlOwnerName(c.getControlOwnerName())
            .testFrequency(c.getTestFrequency()).testFrequencyDays(c.getTestFrequencyDays())
            .linkedObligationIds(c.getLinkedObligationIds())
            .inherentRisk(c.getInherentRisk()).residualRisk(c.getResidualRisk())
            .status(c.getStatus()).createdAt(c.getCreatedAt()).updatedAt(c.getUpdatedAt()).build();
    }
}
