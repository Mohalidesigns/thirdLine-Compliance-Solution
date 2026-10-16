package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.service.FileStorageService;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookExecution;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookExecutionRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.exception.DocumentUnavailableException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Examiner-ready evidence pack (spec §8.5, M21): a ZIP holding every evidence file, a
 * {@code manifest.json} (file, SHA-256, capturer, UTC timestamp, clauses, sign-offs) and a PDF
 * report (clauses satisfied, procedure as executed, evidence index, sign-offs, deviations).
 * The SHA-256 of the ZIP is stored as {@code pack_hash}, so re-hashing the download verifies it.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RunbookEvidencePackService {

    private static final Set<String> PACK_ROLES = Set.of(AppRole.ANALYST, AppRole.CCO, AppRole.TENANT_ADMIN, AppRole.AUDITOR);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm").withZone(ZoneId.of("Africa/Lagos"));

    private final RunbookExecutionService executionService;
    private final RunbookExecutionRepository executions;
    private final EvidenceFileRepository evidenceFiles;
    private final FileStorageService storage;
    private final AuditService audit;

    private final ObjectMapper json = new ObjectMapper().registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).enable(SerializationFeature.INDENT_OUTPUT);

    @Transactional
    public ExecutionDetailDto generate(Long execId, PackRequest req, User user) {
        if (!PACK_ROLES.contains(user.getRole())) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "forbidden", "Your role cannot generate evidence packs");
        }
        RunbookExecution e = executionService.find(execId);
        if (!EX_PENDING_SIGNOFF.equals(e.getStatus()) && !CLOSED_EXECUTION_STATUSES.contains(e.getStatus())) {
            throw ApiException.conflict("The evidence pack is generated once the execution has finished");
        }
        ExecutionDetailDto d = executionService.detail(e);
        boolean includeCommands = !Boolean.FALSE.equals(req != null ? req.getIncludeCommands() : null);
        Instant now = Instant.now();
        try {
            ByteArrayOutputStream zipBytes = new ByteArrayOutputStream();
            List<Map<String, Object>> files = new ArrayList<>();
            try (ZipOutputStream zip = new ZipOutputStream(zipBytes)) {
                for (StepExecutionDto s : d.getSteps()) {
                    for (EvidenceItemDto ev : s.getEvidence()) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("evidenceId", ev.getEvidenceId());
                        m.put("step", s.getStepCode());
                        m.put("type", ev.getEvidenceType());
                        m.put("sha256", ev.getSha256());
                        m.put("capturedBy", ev.getCapturedByName());
                        m.put("capturedAtUtc", ev.getCapturedAt() != null ? ev.getCapturedAt().toString() : null);
                        if (ev.getFileId() != null) {
                            EvidenceFile f = evidenceFiles.findById(ev.getFileId()).orElse(null);
                            if (f != null) {
                                byte[] bytes;
                                try {
                                    bytes = storage.load(f.getStoragePath());
                                } catch (java.nio.file.NoSuchFileException missing) {
                                    throw new DocumentUnavailableException("Evidence file " + f.getOriginalName() + " is no longer in storage");
                                }
                                String actual = RunbookTreeService.sha256(bytes);
                                if (!actual.equals(ev.getSha256())) {
                                    throw ApiException.conflict("evidence_tampered",
                                        "Evidence " + ev.getEvidenceId() + " no longer matches its recorded SHA-256 — pack not generated");
                                }
                                String entry = "evidence/" + ev.getEvidenceId() + "-" + safe(f.getOriginalName());
                                zip.putNextEntry(new ZipEntry(entry));
                                zip.write(bytes);
                                zip.closeEntry();
                                m.put("file", entry);
                            }
                        } else {
                            m.put("externalRef", ev.getExternalRef());
                            m.put("attestation", ev.getAttestationText());
                        }
                        files.add(m);
                    }
                }
                Map<String, Object> manifest = new LinkedHashMap<>();
                manifest.put("format", "atheris-evidence-pack/1");
                manifest.put("execution", d.getExecutionRef());
                manifest.put("runbook", d.getRunbookCode() + " — " + d.getRunbookTitle());
                manifest.put("version", d.getVersionNumber());
                manifest.put("outcome", d.getOutcome());
                manifest.put("status", d.getStatus());
                manifest.put("generatedAtUtc", now.toString());
                manifest.put("generatedBy", user.getFullName());
                if (req != null && req.getAuditorName() != null) manifest.put("auditor", req.getAuditorName());
                if (req != null && req.getAuditorFirm() != null) manifest.put("auditorFirm", req.getAuditorFirm());
                manifest.put("clauses", d.getClauses().stream().map(c -> c.getFrameworkCode() + " " + c.getClauseRef()).toList());
                manifest.put("signoffs", d.getSignoffs());
                manifest.put("evidence", files);
                byte[] manifestBytes = json.writeValueAsBytes(manifest);
                zip.putNextEntry(new ZipEntry("manifest.json"));
                zip.write(manifestBytes);
                zip.closeEntry();
                zip.putNextEntry(new ZipEntry("manifest.sha256"));
                zip.write((RunbookTreeService.sha256(manifestBytes) + "  manifest.json\n").getBytes());
                zip.closeEntry();
                zip.putNextEntry(new ZipEntry(d.getExecutionRef() + "-report.pdf"));
                zip.write(renderPdf(d, req, includeCommands, user, now));
                zip.closeEntry();
            }
            byte[] pack = zipBytes.toByteArray();
            String hash = RunbookTreeService.sha256(pack);
            String name = d.getExecutionRef() + "-evidence-pack.zip";
            String path = storage.storeBytes(name, pack);
            EvidenceFile f = evidenceFiles.save(EvidenceFile.builder()
                .fileName(path.substring(path.lastIndexOf(java.io.File.separator) + 1)).originalName(name)
                .mimeType("application/zip").fileSize((long) pack.length).storagePath(path)
                .sourceType(EVIDENCE_SOURCE_PACK).sourceId(execId)
                .description("Evidence pack " + d.getExecutionRef() + " sha256=" + hash).uploadedByUserId(user.getUserId()).build());
            e.setPackFileId(f.getFileId());
            e.setPackHash(hash);
            e.setPackGeneratedAt(now);
            executions.save(e);
            audit.log(user.getUserId(), "pack_generated", SUBJECT_EXECUTION, execId,
                Map.of("packHash", hash, "files", files.size(), "fileId", f.getFileId()));
            return executionService.detail(e);
        } catch (ApiException | DocumentUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Evidence pack generation failed", ex);
        }
    }

    @Transactional(readOnly = true)
    public Map.Entry<String, byte[]> download(Long execId, User user) {
        if (!PACK_ROLES.contains(user.getRole()) && !AppRole.IT_OPS.equals(user.getRole())) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "forbidden", "Your role cannot download evidence packs");
        }
        RunbookExecution e = executionService.find(execId);
        if (e.getPackFileId() == null) throw ApiException.notFound("No evidence pack has been generated for this execution");
        EvidenceFile f = evidenceFiles.findById(e.getPackFileId()).orElseThrow(() -> ApiException.notFound("Pack file missing"));
        try {
            return Map.entry(f.getOriginalName(), storage.load(f.getStoragePath()));
        } catch (java.nio.file.NoSuchFileException ex) {
            throw new DocumentUnavailableException("The stored evidence pack is no longer available");
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Reading the evidence pack failed", ex);
        }
    }

    private byte[] renderPdf(ExecutionDetailDto d, PackRequest req, boolean includeCommands, User user, Instant now) throws Exception {
        StringBuilder h = new StringBuilder();
        h.append("<html><head><style>")
            .append("body{font-family:Helvetica,Arial,sans-serif;font-size:10pt;color:#1a202c}")
            .append("h1{font-size:18pt;color:#1a365d;margin:0 0 4pt}h2{font-size:12pt;color:#1a365d;border-bottom:1px solid #cbd5e0;padding-bottom:2pt;margin-top:14pt}")
            .append("table{width:100%;border-collapse:collapse;margin-top:4pt}td,th{border:1px solid #e2e8f0;padding:3pt 4pt;vertical-align:top;font-size:8.5pt}")
            .append("th{background:#f7fafc;text-align:left}.mono{font-family:Courier,monospace;font-size:7.5pt;word-wrap:break-word}")
            .append(".muted{color:#718096}.pass{color:#276749;font-weight:bold}.fail{color:#c53030;font-weight:bold}")
            .append("</style></head><body>");
        h.append("<h1>Evidence Pack — ").append(esc(d.getExecutionRef())).append("</h1>");
        h.append("<div class='muted'>").append(esc(d.getRunbookCode())).append(" · ").append(esc(d.getRunbookTitle()))
            .append(" · version ").append(d.getVersionNumber()).append("</div>");
        h.append("<table><tr><th>Outcome</th><td class='").append("PASS".equals(d.getOutcome()) ? "pass" : "fail").append("'>")
            .append(esc(d.getOutcome())).append(" (").append(esc(d.getStatus())).append(")</td><th>Operator</th><td>")
            .append(esc(d.getOperatorName())).append("</td></tr>")
            .append("<tr><th>Started</th><td>").append(ts(d.getStartedAt())).append("</td><th>Completed</th><td>").append(ts(d.getCompletedAt())).append("</td></tr>")
            .append("<tr><th>Due</th><td>").append(ts(d.getDueAt())).append("</td><th>Steps</th><td>").append(d.getStepsPassed())
            .append(" passed · ").append(d.getStepsFailed()).append(" failed · ").append(d.getStepsSkipped()).append(" skipped/N/A</td></tr>")
            .append("<tr><th>Generated</th><td>").append(ts(now)).append(" by ").append(esc(user.getFullName())).append("</td><th>Prepared for</th><td>")
            .append(esc(req != null ? join(req.getAuditorName(), req.getAuditorFirm()) : "")).append("</td></tr></table>");

        h.append("<h2>Framework clauses satisfied</h2><table><tr><th>Framework</th><th>Clause</th><th>Title</th></tr>");
        d.getClauses().forEach(c -> h.append("<tr><td>").append(esc(c.getFrameworkCode())).append("</td><td>").append(esc(c.getClauseRef()))
            .append("</td><td>").append(esc(c.getTitle())).append("</td></tr>"));
        h.append("</table>");

        h.append("<h2>Procedure as executed</h2><table><tr><th>Step</th><th>Title</th><th>Status</th><th>Performed / verified</th><th>Actual result</th></tr>");
        for (StepExecutionDto s : d.getSteps()) {
            h.append("<tr><td>").append(esc(s.getStepCode())).append("</td><td>").append(esc(s.getTitle()));
            if (includeCommands && s.getCommandBlock() != null) h.append("<div class='mono'>").append(esc(s.getCommandBlock())).append("</div>");
            h.append("</td><td>").append(esc(s.getStatus())).append("</td><td>").append(esc(s.getPerformedByName()));
            if (s.getVerifiedByName() != null) h.append(" / ").append(esc(s.getVerifiedByName()));
            h.append("</td><td>").append(esc(s.getActualResult() != null ? s.getActualResult() : s.getSkipReason())).append("</td></tr>");
        }
        h.append("</table>");

        h.append("<h2>Evidence index</h2><table><tr><th>#</th><th>Step</th><th>Type</th><th>Item</th><th>SHA-256</th><th>Captured</th></tr>");
        for (StepExecutionDto s : d.getSteps()) {
            for (EvidenceItemDto ev : s.getEvidence()) {
                String item = ev.getFileName() != null ? ev.getFileName() : ev.getExternalRef() != null ? ev.getExternalRef() : ev.getAttestationText();
                h.append("<tr><td>").append(ev.getEvidenceId()).append("</td><td>").append(esc(s.getStepCode())).append("</td><td>")
                    .append(esc(ev.getEvidenceType())).append("</td><td>").append(esc(item)).append("</td><td class='mono'>")
                    .append(esc(ev.getSha256())).append("</td><td>").append(esc(ev.getCapturedByName())).append("<br/>")
                    .append(ts(ev.getCapturedAt())).append("</td></tr>");
            }
        }
        h.append("</table>");

        h.append("<h2>Deviations</h2>");
        List<StepExecutionDto> dev = d.getSteps().stream().filter(s -> ST_FAILED.equals(s.getStatus()) || ST_SKIPPED.equals(s.getStatus()) || ST_NA.equals(s.getStatus())).toList();
        if (dev.isEmpty()) {
            h.append("<p class='muted'>None.</p>");
        } else {
            h.append("<table><tr><th>Step</th><th>Status</th><th>Reason / category</th></tr>");
            dev.forEach(s -> h.append("<tr><td>").append(esc(s.getStepCode())).append("</td><td>").append(esc(s.getStatus())).append("</td><td>")
                .append(esc(join(s.getFailureCategory(), s.getSkipReason() != null ? s.getSkipReason() : s.getActualResult()))).append("</td></tr>"));
            h.append("</table>");
        }

        h.append("<h2>Escalations</h2>");
        if (d.getEscalations().isEmpty()) {
            h.append("<p class='muted'>None.</p>");
        } else {
            h.append("<table><tr><th>Level</th><th>Trigger</th><th>Notified</th><th>Sent</th><th>Acknowledged</th></tr>");
            d.getEscalations().forEach(x -> h.append("<tr><td>").append(x.getLevel()).append("</td><td>").append(esc(x.getTriggerType()))
                .append("</td><td>").append(esc(join(x.getNotifiedRole(), x.getNotifiedName()))).append("</td><td>").append(ts(x.getSentAt()))
                .append("</td><td>").append(ts(x.getAcknowledgedAt())).append("</td></tr>"));
            h.append("</table>");
        }

        h.append("<h2>Sign-offs</h2>");
        if (d.getSignoffs().isEmpty()) {
            h.append("<p class='muted'>None recorded.</p>");
        } else {
            h.append("<table><tr><th>Role</th><th>Name</th><th>Decision</th><th>Comment</th><th>Signed</th></tr>");
            d.getSignoffs().forEach(x -> h.append("<tr><td>").append(esc(x.getSignoffRole())).append("</td><td>").append(esc(x.getUserName()))
                .append("</td><td>").append(esc(x.getDecision())).append("</td><td>").append(esc(x.getComment())).append("</td><td>")
                .append(ts(x.getSignedAt())).append("</td></tr>"));
            h.append("</table>");
        }
        h.append("<p class='muted' style='margin-top:12pt'>Every file in this pack is listed with its SHA-256 in manifest.json; "
            + "the SHA-256 of the pack ZIP is recorded in Atheris.</p></body></html>");

        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder b = new PdfRendererBuilder();
            b.useFastMode();
            b.withHtmlContent(h.toString(), null);
            b.toStream(os);
            b.run();
            return os.toByteArray();
        }
    }

    private static String ts(Instant i) {
        return i == null ? "–" : TS.format(i);
    }

    private static String join(String a, String b) {
        if (a == null || a.isBlank()) return b == null ? "" : b;
        if (b == null || b.isBlank()) return a;
        return a + " · " + b;
    }

    private static String safe(String name) {
        return name == null ? "file" : name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '&' -> b.append("&amp;");
                case '"' -> b.append("&quot;");
                case '\'' -> b.append("&#39;");
                case '\n' -> b.append("<br/>");
                default -> { if (c >= 0x20 || c == '\t') b.append(c); }
            }
        }
        return b.toString();
    }
}
