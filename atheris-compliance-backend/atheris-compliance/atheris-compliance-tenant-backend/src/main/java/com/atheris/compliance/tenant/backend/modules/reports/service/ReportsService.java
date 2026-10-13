package com.atheris.compliance.tenant.backend.modules.reports.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.ComplianceMetricsService;
import com.atheris.compliance.tenant.backend.modules.evidence.service.FileStorageService;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.reports.dto.*;
import com.atheris.compliance.tenant.backend.modules.reports.entity.BoardPack;
import com.atheris.compliance.tenant.backend.modules.reports.repository.BoardPackRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReportsService {

    private static final List<String> DEFAULT_SECTIONS = List.of(
        "summary", "attention", "risk", "coverage", "returns", "findings", "sanctions");

    private final BoardPackRepository repo;
    private final ComplianceMetricsService metrics;
    private final BoardPackRenderer renderer;
    private final FileStorageService storage;
    private final TenantIdentityService tenantIdentity;
    private final AuditService audit;

    public Page<BoardPackDto> list(Pageable p) {
        return repo.findAllByOrderByGeneratedAtDesc(p).map(this::toDto);
    }

    public BoardPackDto get(Long id) {
        return toDto(load(id));
    }

    public BoardPackPreviewDto preview(LocalDate from, LocalDate to, List<String> sections) {
        ComplianceMetricsDto m = metrics.compute(from, to);
        TenantProfile profile = tenantIdentity.currentProfile().orElse(null);
        return BoardPackPreviewDto.builder()
            .institutionName(profile != null ? profile.getLegalName() : "Institution")
            .licenceType(profile != null ? profile.getLicenceType() : null)
            .periodFrom(from).periodTo(to)
            .sections(sections == null || sections.isEmpty() ? DEFAULT_SECTIONS : sections)
            .metrics(m)
            .previousScore(previousScore())
            .build();
    }

    @Transactional
    public BoardPackDto generate(GenerateBoardPackRequest req, User user) {
        if (req.getPeriodTo().isBefore(req.getPeriodFrom()))
            throw ApiException.badRequest("periodTo must not be before periodFrom");
        List<String> sections = req.getSections() == null || req.getSections().isEmpty()
            ? DEFAULT_SECTIONS : req.getSections();

        ComplianceMetricsDto m = metrics.compute(req.getPeriodFrom(), req.getPeriodTo());
        TenantProfile profile = tenantIdentity.currentProfile().orElse(null);
        String institution = profile != null ? profile.getLegalName() : "Institution";
        String licence = profile != null ? profile.getLicenceType() : null;

        byte[] pdf = renderer.render(institution, licence, req.getPeriodFrom(), req.getPeriodTo(),
            m, previousScore(), sections, true, user != null ? user.getFullName() : null);

        String storedPath = store(pdf, req.getPeriodFrom(), req.getPeriodTo());

        BoardPack pack = BoardPack.builder()
            .tenantId(tenantIdentity.currentTenantId())
            .periodFrom(req.getPeriodFrom()).periodTo(req.getPeriodTo())
            .sections(sections)
            .status("DRAFT")
            .complianceScore(m.getComplianceScore())
            .filePath(storedPath)
            .fileName(fileName(req.getPeriodFrom(), req.getPeriodTo()))
            .fileSha256(sha256(pdf))
            .generatedByUserId(user != null ? user.getUserId() : null)
            .generatedByName(user != null ? user.getFullName() : "System")
            .build();
        pack = repo.save(pack);

        audit.log(user != null ? user.getUserId() : null, "board_pack_generated", "board_pack", pack.getBoardPackId(),
            Map.of("periodFrom", req.getPeriodFrom().toString(), "periodTo", req.getPeriodTo().toString(),
                   "score", pack.getComplianceScore() == null ? -1 : pack.getComplianceScore()));
        return toDto(pack);
    }

    @Transactional
    public BoardPackDto signOff(Long id, SignOffRequest req, User user) {
        BoardPack pack = load(id);
        if ("SIGNED_OFF".equals(pack.getStatus()))
            throw ApiException.conflict("already_signed_off", "This board pack is already signed off");

        ComplianceMetricsDto m = metrics.compute(pack.getPeriodFrom(), pack.getPeriodTo());
        TenantProfile profile = tenantIdentity.currentProfile().orElse(null);
        String institution = profile != null ? profile.getLegalName() : "Institution";
        String licence = profile != null ? profile.getLicenceType() : null;

        // Re-render without the DRAFT watermark and with the sign-off block.
        byte[] pdf = renderer.render(institution, licence, pack.getPeriodFrom(), pack.getPeriodTo(),
            m, previousScore(), pack.getSections(), false, pack.getGeneratedByName());

        replace(pack.getFilePath(), pdf);

        pack.setStatus("SIGNED_OFF");
        pack.setFileSha256(sha256(pdf));
        pack.setSignedOffByUserId(user != null ? user.getUserId() : null);
        pack.setSignedOffByName(user != null ? user.getFullName() : null);
        pack.setSignedOffAt(java.time.Instant.now());
        pack.setSignOffNote(req != null ? req.getNote() : null);
        pack = repo.save(pack);

        audit.log(user != null ? user.getUserId() : null, "board_pack_signed_off", "board_pack", pack.getBoardPackId(),
            Map.of("sha256", pack.getFileSha256()));
        return toDto(pack);
    }

    public byte[] download(Long id) {
        BoardPack pack = load(id);
        try {
            byte[] bytes = Files.readAllBytes(Path.of(pack.getFilePath()));
            audit.log(null, "board_pack_downloaded", "board_pack", pack.getBoardPackId(), Map.of());
            return bytes;
        } catch (IOException e) {
            throw ApiException.notFound("Board pack file is unavailable");
        }
    }

    public String fileNameFor(Long id) {
        return load(id).getFileName();
    }

    // ── helpers ──

    private Double previousScore() {
        return repo.findFirstByOrderByPeriodToDescBoardPackIdDesc()
            .map(BoardPack::getComplianceScore).orElse(null);
    }

    private BoardPack load(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Board pack not found: " + id));
    }

    private String store(byte[] pdf, LocalDate from, LocalDate to) {
        try {
            String p = storage.storeBytes(fileName(from, to), pdf);
            return p;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store board pack: " + e.getMessage(), e);
        }
    }

    private void replace(String path, byte[] pdf) {
        try {
            Files.write(Path.of(path), pdf);
        } catch (IOException e) {
            throw new RuntimeException("Failed to update board pack: " + e.getMessage(), e);
        }
    }

    private static String fileName(LocalDate from, LocalDate to) {
        return "board-pack-" + from + "_" + to + ".pdf";
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private BoardPackDto toDto(BoardPack p) {
        return BoardPackDto.builder()
            .boardPackId(p.getBoardPackId())
            .periodFrom(p.getPeriodFrom()).periodTo(p.getPeriodTo())
            .sections(p.getSections()).status(p.getStatus())
            .complianceScore(p.getComplianceScore())
            .fileName(p.getFileName()).fileSha256(p.getFileSha256())
            .generatedByName(p.getGeneratedByName()).generatedAt(p.getGeneratedAt())
            .signedOffByName(p.getSignedOffByName()).signedOffAt(p.getSignedOffAt()).signOffNote(p.getSignOffNote())
            .build();
    }
}