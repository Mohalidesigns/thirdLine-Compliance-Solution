package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.Runbook;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Authoring linter (runbook spec §7, rules L1–L10) plus structural validation of a draft tree.
 * ERROR rules block submit and publish, so L3, L5, L7 and L9 cannot be bypassed through the API;
 * L9 (secrets in commands) is also rejected outright when a draft is saved.
 */
@Service
public class RunbookLintService {

    private static final Set<String> IMPERATIVE_VERBS = Set.of(
        "acknowledge", "add", "analyse", "analyze", "apply", "approve", "archive", "assess", "assign", "attach", "attest",
        "back", "block", "brief", "calculate", "call", "capture", "check", "classify", "close", "collect", "compare",
        "compile", "complete", "configure", "confirm", "contain", "copy", "create", "cut", "decide", "define", "delete",
        "deploy", "determine", "disable", "dispatch", "document", "download", "draft", "enable", "ensure", "enter",
        "escalate", "establish", "evaluate", "execute", "export", "file", "fill", "filter", "flag", "forward", "generate",
        "grant", "hash", "identify", "implement", "import", "inform", "initiate", "inspect", "install", "investigate",
        "isolate", "issue", "list", "load", "locate", "lock", "log", "map", "mark", "measure", "merge", "monitor", "move",
        "notify", "obtain", "open", "patch", "perform", "pick", "place", "plan", "post", "prepare", "preserve", "prioritise",
        "prioritize", "produce", "pull", "query", "raise", "re-enable", "reboot", "reconcile", "record", "redact", "re-run",
        "register", "reissue", "remediate", "remove", "rename", "replace", "report", "request", "rescan", "reset", "resolve",
        "respond", "restart", "restore", "retain", "retire", "revert", "review", "revoke", "rotate", "run", "save", "scan",
        "schedule", "screen", "search", "select", "send", "set", "share", "sign", "snapshot", "start", "stop", "store",
        "submit", "summarise", "summarize", "take", "tag", "test", "track", "train", "transfer", "triage", "trigger",
        "unlock", "update", "upload", "use", "validate", "verify", "walk", "write");

    private static final Pattern DESTRUCTIVE = Pattern.compile(
        "(?i)(\\bDROP\\b|rm\\s+-rf|\\bDisable-|\\bRemove-|\\bDELETE\\b)");

    /** Apparent credential literals: password=…, token: …, Bearer <long>, AWS keys, private keys. */
    private static final Pattern SECRET = Pattern.compile(
        "(?i)((password|passwd|pwd|secret|api[_-]?key|token)\\s*[:=]\\s*['\"]?(?![<$%{])[^\\s'\"<>]{4,})"
            + "|(bearer\\s+[A-Za-z0-9._\\-]{20,})|(AKIA[0-9A-Z]{16})|(-----BEGIN [A-Z ]*PRIVATE KEY-----)"
            + "|(-p\\s*['\"][^'\"$<]{4,}['\"])");

    public LintReportDto lint(Runbook rb, SaveVersionRequest tree, int runbookClauseCount) {
        List<LintReportDto.LintIssue> issues = new ArrayList<>();
        List<SectionDto> sections = nz(tree.getSections());
        Set<String> rolledBackCodes = new HashSet<>();
        nz(tree.getRollbackSteps()).forEach(r -> { if (r.getReversesStepCode() != null) rolledBackCodes.add(r.getReversesStepCode().trim()); });

        if (sections.stream().allMatch(s -> nz(s.getSteps()).isEmpty())) {
            issues.add(issue("L3", "ERROR", "The procedure has no steps", null, null, null));
        }
        for (int si = 0; si < sections.size(); si++) {
            SectionDto s = sections.get(si);
            List<StepDto> steps = nz(s.getSteps());
            for (int ti = 0; ti < steps.size(); ti++) {
                StepDto st = steps.get(ti);
                String code = st.getStepCode() != null ? st.getStepCode() : (si + 1) + "." + (ti + 1);
                String instr = st.getInstructionMd() == null ? "" : st.getInstructionMd().trim();
                String firstWord = instr.isEmpty() ? "" : instr.split("[\\s,.:;]+")[0].replaceAll("[^A-Za-z-]", "").toLowerCase();
                if (!IMPERATIVE_VERBS.contains(firstWord)) {
                    issues.add(issue("L1", "WARN", "Start the instruction with an action verb (Run, Export, Verify…)", code, si, ti));
                }
                long sentences = Arrays.stream(instr.split("(?<=[.!?])\\s+")).filter(x -> !x.isBlank()).count();
                if (instr.length() > 400 || sentences > 3) {
                    issues.add(issue("L2", "WARN", "Keep the instruction to 3 sentences / 400 characters; move detail to the command block", code, si, ti));
                }
                if (SECTION_EXECUTION.equals(s.getSectionType()) && nz(st.getEvidenceReqs()).isEmpty()) {
                    issues.add(issue("L3", "ERROR", "Execution steps must require at least one piece of evidence", code, si, ti));
                }
                boolean hasCommand = st.getCommandBlock() != null && !st.getCommandBlock().isBlank();
                if (hasCommand && (st.getExpectedResult() == null || st.getExpectedResult().isBlank())) {
                    issues.add(issue("L4", "WARN", "Add the expected result of the command", code, si, ti));
                }
                if (hasCommand && DESTRUCTIVE.matcher(st.getCommandBlock()).find()) {
                    boolean noted = st.getSafetyNote() != null && !st.getSafetyNote().isBlank();
                    if (!noted || !rolledBackCodes.contains(code)) {
                        issues.add(issue("L5", "ERROR",
                            "Destructive command: add a safety note and a rollback step that reverses step " + code, code, si, ti));
                    }
                }
                if (st.getAssignedRole() == null || st.getAssignedRole().isBlank()) {
                    issues.add(issue("L8", "WARN", "Assign a role to the step", code, si, ti));
                }
                if (hasCommand && containsSecret(st.getCommandBlock())) {
                    issues.add(issue("L9", "ERROR", "The command contains what looks like a password or token — use a placeholder", code, si, ti));
                }
            }
        }
        nz(tree.getRollbackSteps()).forEach(r -> {
            if (r.getCommandBlock() != null && containsSecret(r.getCommandBlock())) {
                issues.add(issue("L9", "ERROR", "Rollback step \"" + r.getTitle() + "\" contains what looks like a secret", r.getReversesStepCode(), null, null));
            }
        });
        List<EscalationDto> esc = nz(tree.getEscalations());
        if (requiresApproval(rb.getCriticality()) && esc.isEmpty()) {
            issues.add(issue("L6", "ERROR", "HIGH and CRITICAL runbooks need at least one escalation level", null, null, null));
        }
        if (runbookClauseCount == 0) {
            issues.add(issue("L7", "ERROR", "Map the runbook to at least one framework clause or internal policy", null, null, null));
        }
        if (rb.getSlaMinutes() != null && esc.stream().noneMatch(e -> TRIG_SLA_80.equals(e.getTriggerType()))) {
            issues.add(issue("L10", "WARN", "The runbook has an SLA but no SLA_80 escalation", null, null, null));
        }
        int errors = (int) issues.stream().filter(i -> "ERROR".equals(i.getSeverity())).count();
        return LintReportDto.builder().errors(errors).warnings(issues.size() - errors).issues(issues).build();
    }

    public boolean containsSecret(String text) {
        return text != null && SECRET.matcher(text).find();
    }

    /** Structural validation of a draft tree; throws 400 with a precise message. */
    public void validateTree(SaveVersionRequest req) {
        for (PrerequisiteDto p : nz(req.getPrerequisites())) {
            require(p.getLabel(), "Every prerequisite needs a label");
            requireIn(p.getPrereqType(), PREREQ_TYPES, "prerequisite type");
        }
        Set<String> codes = new HashSet<>();
        for (SectionDto s : nz(req.getSections())) {
            require(s.getTitle(), "Every section needs a title");
            requireIn(s.getSectionType(), SECTION_TYPES, "section type");
            for (StepDto st : nz(s.getSteps())) {
                require(st.getTitle(), "Every step needs a title");
                require(st.getInstructionMd(), "Step \"" + st.getTitle() + "\" needs an instruction");
                if (st.getStepCode() != null && !st.getStepCode().isBlank() && !codes.add(st.getStepCode().trim())) {
                    throw ApiException.badRequest("duplicate_step_code", "Step code " + st.getStepCode() + " is used twice");
                }
                if (containsSecret(st.getCommandBlock())) {
                    throw ApiException.badRequest("secret_in_command",
                        "Step " + (st.getStepCode() != null ? st.getStepCode() : st.getTitle())
                            + ": the command contains what looks like a password or token. Use a placeholder such as <password> or $env:VAR.");
                }
                for (EvidenceReqDto r : nz(st.getEvidenceReqs())) {
                    requireIn(r.getEvidenceType(), EVIDENCE_TYPES, "evidence type");
                    if (!Boolean.FALSE.equals(r.getMandatory())) {
                        require(r.getLabel(), "Mandatory evidence on step \"" + st.getTitle() + "\" needs a label");
                    } else if (r.getLabel() == null || r.getLabel().isBlank()) {
                        r.setLabel(r.getEvidenceType());
                    }
                }
            }
        }
        List<Integer> levels = new ArrayList<>();
        for (EscalationDto e : nz(req.getEscalations())) {
            if (e.getLevel() == null || e.getLevel() < 1) throw ApiException.badRequest("Escalation levels start at 1");
            requireIn(e.getTriggerType(), ESCALATION_TRIGGERS, "escalation trigger");
            if (e.getNotifyRole() == null && e.getNotifyUserId() == null) {
                throw ApiException.badRequest("Escalation level " + e.getLevel() + " must notify a role or a user");
            }
            levels.add(e.getLevel());
        }
        for (int i = 1; i < levels.size(); i++) {
            if (levels.get(i) < levels.get(i - 1)) {
                throw ApiException.badRequest("Escalation levels must be in ascending order");
            }
        }
        for (RollbackStepDto r : nz(req.getRollbackSteps())) {
            require(r.getTitle(), "Every rollback step needs a title");
            require(r.getInstructionMd(), "Rollback step \"" + r.getTitle() + "\" needs an instruction");
            if (containsSecret(r.getCommandBlock())) {
                throw ApiException.badRequest("secret_in_command", "Rollback step \"" + r.getTitle() + "\" contains what looks like a secret");
            }
        }
    }

    private static void require(String v, String message) {
        if (v == null || v.isBlank()) throw ApiException.badRequest(message);
    }

    private static void requireIn(String v, Set<String> allowed, String what) {
        if (v == null || !allowed.contains(v)) throw ApiException.badRequest("Invalid " + what + ": " + v);
    }

    private static LintReportDto.LintIssue issue(String rule, String sev, String msg, String code, Integer si, Integer ti) {
        return LintReportDto.LintIssue.builder().rule(rule).severity(sev).message(msg).stepCode(code)
            .sectionIndex(si).stepIndex(ti).build();
    }

    private static <T> List<T> nz(List<T> l) {
        return l == null ? List.of() : l;
    }
}
