// Runbook builder — local tree model, SaveVersionRequest mapping, client-side lint hints.
// The server lint (POST /runbooks/{id}/versions/{vid}/lint and the `lint` on every save) is
// authoritative; the hints here only mirror L1, L2, L4, L8 and L9 for instant feedback.

let keySeq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(keySeq += 1)}`;

export const autoStepCode = (si, ti) => `${si + 1}.${ti + 1}`;

export const emptyStep = () => ({
  _key: newKey(), _manualCode: false, stepCode: '', title: '', instructionMd: '', commandBlock: '',
  commandLang: 'none', expectedResult: '', durationEstimateMin: null, assignedRole: '',
  blocking: true, dualControl: false, allowSkip: false, safetyNote: '', clauseIds: [], evidenceReqs: [],
});
export const emptySection = (sectionType = 'EXECUTION') => ({
  _key: newKey(), sectionType, title: '', description: '', steps: [],
});
export const emptyPrereq = (p = {}) => ({
  _key: newKey(), prereqType: 'ACCESS', label: '', detail: '', mandatory: true, ...p,
});
export const emptyEvidenceReq = () => ({
  _key: newKey(), evidenceType: 'SCREENSHOT', label: '', mandatory: true, retentionYears: 7,
});
export const emptyEscalation = (level = 1) => ({
  _key: newKey(), level, triggerType: 'STEP_FAILED', notifyRole: 'CCO', notifyChannel: 'IN_APP',
  waitMinutes: 0, instructions: '',
});
export const emptyRollback = () => ({
  _key: newKey(), reversesStepCode: '', title: '', instructionMd: '', commandBlock: '', verification: '',
});

const str = (v) => (v == null ? '' : String(v));

/** RunbookVersionTreeDto → local editable tree (adds React keys, flags hand-edited step codes). */
export function treeFromVersion(v) {
  if (!v) return { prerequisites: [], sections: [], escalations: [], rollbackSteps: [] };
  const sections = [...(v.sections || [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((s, si) => ({
      _key: newKey(),
      sectionType: s.sectionType || 'EXECUTION',
      title: str(s.title),
      description: str(s.description),
      steps: [...(s.steps || [])]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((st, ti) => ({
          _key: newKey(),
          _manualCode: !!st.stepCode && st.stepCode !== autoStepCode(si, ti),
          stepCode: str(st.stepCode) || autoStepCode(si, ti),
          title: str(st.title),
          instructionMd: str(st.instructionMd),
          commandBlock: str(st.commandBlock),
          commandLang: st.commandLang || 'none',
          expectedResult: str(st.expectedResult),
          durationEstimateMin: st.durationEstimateMin ?? null,
          assignedRole: st.assignedRole || '',
          blocking: st.blocking ?? true,
          dualControl: !!st.dualControl,
          allowSkip: !!st.allowSkip,
          safetyNote: str(st.safetyNote),
          clauseIds: [...(st.clauseIds || [])],
          evidenceReqs: (st.evidenceReqs || []).map((e) => ({
            _key: newKey(), evidenceType: e.evidenceType || 'SCREENSHOT', label: str(e.label),
            mandatory: e.mandatory ?? true, retentionYears: e.retentionYears ?? null,
          })),
        })),
    }));
  return {
    prerequisites: (v.prerequisites || []).map((p) => ({
      _key: newKey(), prereqType: p.prereqType || 'ACCESS', label: str(p.label), detail: str(p.detail),
      mandatory: p.mandatory ?? true,
    })),
    sections,
    escalations: [...(v.escalations || [])]
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      .map((e) => ({
        _key: newKey(), level: e.level ?? 1, triggerType: e.triggerType || 'STEP_FAILED',
        notifyRole: e.notifyRole || '', notifyChannel: e.notifyChannel || 'IN_APP',
        waitMinutes: e.waitMinutes ?? 0, instructions: str(e.instructions),
        notifyUserId: e.notifyUserId ?? null,
      })),
    rollbackSteps: [...(v.rollbackSteps || [])]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((r) => ({
        _key: newKey(), reversesStepCode: str(r.reversesStepCode), title: str(r.title),
        instructionMd: str(r.instructionMd), commandBlock: str(r.commandBlock), verification: str(r.verification),
      })),
  };
}

const nul = (v) => (v === '' || v == null ? null : v);
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/** Local tree → SaveVersionRequest (ids omitted; sortOrder from position). */
export function toSaveRequest(tree) {
  return {
    prerequisites: tree.prerequisites.map((p) => ({
      prereqType: p.prereqType, label: p.label, detail: nul(p.detail), mandatory: !!p.mandatory,
    })),
    sections: tree.sections.map((s, si) => ({
      sortOrder: si + 1,
      sectionType: s.sectionType,
      title: s.title,
      description: nul(s.description),
      steps: s.steps.map((st, ti) => ({
        sortOrder: ti + 1,
        stepCode: st.stepCode || autoStepCode(si, ti),
        title: st.title,
        instructionMd: st.instructionMd,
        commandBlock: nul(st.commandBlock),
        commandLang: st.commandLang || 'none',
        expectedResult: nul(st.expectedResult),
        durationEstimateMin: num(st.durationEstimateMin),
        assignedRole: nul(st.assignedRole),
        blocking: !!st.blocking,
        dualControl: !!st.dualControl,
        allowSkip: !!st.allowSkip,
        safetyNote: nul(st.safetyNote),
        clauseIds: st.clauseIds || [],
        evidenceReqs: (st.evidenceReqs || []).map((e) => ({
          evidenceType: e.evidenceType, label: e.label, mandatory: !!e.mandatory,
          retentionYears: num(e.retentionYears),
        })),
      })),
    })),
    escalations: tree.escalations.map((e) => ({
      level: num(e.level), triggerType: e.triggerType, notifyRole: nul(e.notifyRole),
      notifyUserId: e.notifyUserId ?? null, notifyChannel: e.notifyChannel,
      waitMinutes: num(e.waitMinutes) ?? 0, instructions: nul(e.instructions),
    })),
    rollbackSteps: tree.rollbackSteps.map((r, i) => ({
      sortOrder: i + 1, reversesStepCode: nul(r.reversesStepCode), title: r.title,
      instructionMd: nul(r.instructionMd), commandBlock: nul(r.commandBlock), verification: nul(r.verification),
    })),
  };
}

/**
 * Re-number every step whose code was not hand-edited ("<section>.<step>") and remap the
 * rollback steps that pointed at a renamed code, so reordering never orphans a rollback.
 */
export function renumber(tree) {
  const remap = {};
  const sections = tree.sections.map((s, si) => ({
    ...s,
    steps: s.steps.map((st, ti) => {
      if (st._manualCode && st.stepCode) return st;
      const code = autoStepCode(si, ti);
      if (st.stepCode && st.stepCode !== code) remap[st.stepCode] = code;
      return st.stepCode === code ? st : { ...st, stepCode: code };
    }),
  }));
  const changed = Object.keys(remap).length > 0;
  const rollbackSteps = changed
    ? tree.rollbackSteps.map((r) => (remap[r.reversesStepCode] ? { ...r, reversesStepCode: remap[r.reversesStepCode] } : r))
    : tree.rollbackSteps;
  return { ...tree, sections, rollbackSteps };
}

export const allSteps = (tree) =>
  tree.sections.flatMap((s, si) => s.steps.map((st, ti) => ({ step: st, si, ti, section: s })));

// ---------------------------------------------------------------- client lint hints

const IMPERATIVE_VERBS = new Set(`
  acknowledge add analyse analyze apply approve archive assign attach back backup block calculate call capture
  change check choose clear click close collect compare compile complete configure confirm connect contact copy
  create deactivate decrypt define delete deploy determine disable document download draft email enable encrypt
  ensure enter escalate establish evaluate execute export extract file fill filter find fix flag forward generate
  grant identify implement import inform initiate inspect install investigate isolate issue launch list load lock
  log login log-in mark match migrate monitor move navigate note notify obtain open patch pause perform prepare
  print pull push query raise reboot reconcile record recover reject remediate remove renew report request reset
  resolve restart restore resume retain retrieve review revoke rotate run save scan schedule search select send
  set share sign snapshot start stop store submit suspend switch take test track transfer trigger unlock update
  upload use validate verify view wait write
`.trim().split(/\s+/));
const NON_VERB_OPENERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'you', 'we', 'i',
  'they', 'there', 'he', 'she', 'our', 'your', 'all', 'each', 'every', 'if', 'when', 'once', 'after', 'before',
  'operator', 'analyst', 'user', 'users', 'system', 'step']);

export const SECRET_PATTERNS = [
  /(password|passwd|pwd)\s*[:=]\s*\S+/i,
  /(token|api[_-]?key|apikey|secret|client[_-]?secret)\s*[:=]\s*\S+/i,
  /bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
export const hasSecret = (text) => !!text && SECRET_PATTERNS.some((re) => re.test(text));

const stripMd = (t) => t.replace(/[`*_>#[\]()]/g, ' ').replace(/^\s*[-\d.]+\s+/, '').trim();

/** Client lint hints for one step. Returns [{rule, severity, field, message}]. */
export function lintStep(step) {
  const out = [];
  const instr = (step.instructionMd || '').trim();
  if (instr) {
    const first = (stripMd(instr).split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z-]/g, '');
    if (first && (NON_VERB_OPENERS.has(first) || /(ing|ed)$/.test(first)
        || (!IMPERATIVE_VERBS.has(first) && /s$/.test(first) && IMPERATIVE_VERBS.has(first.slice(0, -1))))) {
      out.push({ rule: 'L1', severity: 'WARN', field: 'instructionMd',
        message: `Start with an imperative verb (e.g. "Run", "Verify", "Export") — not "${first}".` });
    }
    const sentences = instr.split(/[.!?]+(\s|$)/).filter((s) => s && s.trim().length > 2).length;
    if (instr.length > 400 || sentences > 3) {
      out.push({ rule: 'L2', severity: 'WARN', field: 'instructionMd',
        message: `Instruction is long (${instr.length} chars, ${sentences} sentences) — keep to ≤400 chars / 3 sentences or split the step.` });
    }
  }
  if ((step.commandBlock || '').trim() && !(step.expectedResult || '').trim()) {
    out.push({ rule: 'L4', severity: 'WARN', field: 'expectedResult',
      message: 'A step with a command needs an expected result.' });
  }
  if (!step.assignedRole) {
    out.push({ rule: 'L8', severity: 'WARN', field: 'assignedRole', message: 'Assign a role to this step.' });
  }
  if (hasSecret(step.commandBlock)) {
    out.push({ rule: 'L9', severity: 'ERROR', field: 'commandBlock',
      message: 'Command block appears to contain a secret (password/token/key). Reference a vault entry instead.' });
  }
  return out;
}

/** Validate the escalation ladder (M5: levels unique & ascending). Returns a message or ''. */
export function escalationProblem(escalations) {
  const levels = escalations.map((e) => Number(e.level));
  if (levels.some((l) => !Number.isInteger(l) || l < 1)) return 'Every level must be a whole number ≥ 1.';
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] === levels[i - 1]) return `Level ${levels[i]} is used more than once.`;
    if (levels[i] < levels[i - 1]) return 'Levels must be in ascending order.';
  }
  return '';
}

// ---------------------------------------------------------------- category suggestions (step 2)

export const PREREQ_SUGGESTIONS = {
  ACCESS_REVIEW: [
    { prereqType: 'ACCESS', label: 'Read access to AD / core banking user table' },
    { prereqType: 'DATA', label: 'Current HR headcount export' },
    { prereqType: 'DATA', label: 'Approved role/entitlement matrix' },
  ],
  VULN_MGMT: [
    { prereqType: 'TOOL', label: 'Vulnerability scanner licence and credentials profile' },
    { prereqType: 'WINDOW', label: 'Approved patching maintenance window' },
    { prereqType: 'DATA', label: 'Current asset inventory export' },
  ],
  INCIDENT: [
    { prereqType: 'ACCESS', label: 'Access to SIEM and incident ticketing system' },
    { prereqType: 'DATA', label: 'Regulator notification contacts (CBN / NDPC)' },
    { prereqType: 'APPROVAL', label: 'Incident commander assigned' },
  ],
  CONFIG_AUDIT: [
    { prereqType: 'DATA', label: 'Approved configuration baseline (CIS benchmark)' },
    { prereqType: 'ACCESS', label: 'Read-only admin access to target servers/devices' },
  ],
  CRYPTO: [
    { prereqType: 'ACCESS', label: 'HSM / key management console access (dual custody)' },
    { prereqType: 'DATA', label: 'Certificate and key inventory with expiry dates' },
    { prereqType: 'WINDOW', label: 'Approved change window for rotation' },
  ],
  BCP_DR: [
    { prereqType: 'WINDOW', label: 'Approved DR test window' },
    { prereqType: 'DATA', label: 'Latest backup catalogue and RPO/RTO targets' },
    { prereqType: 'ACCESS', label: 'Access to DR site / restore environment' },
  ],
  PRIVACY: [
    { prereqType: 'DATA', label: 'Data subject identity verification record' },
    { prereqType: 'ACCESS', label: 'Access to personal data inventory (RoPA)' },
  ],
  AML: [
    { prereqType: 'ACCESS', label: 'Transaction monitoring system access' },
    { prereqType: 'TOOL', label: 'NFIU goAML portal credentials (held by MLRO)' },
  ],
  RETURNS: [
    { prereqType: 'DATA', label: 'Period-end trial balance / source data extract' },
    { prereqType: 'TOOL', label: 'Regulator e-filing portal access' },
    { prereqType: 'APPROVAL', label: 'Sign-off authority for submission' },
  ],
  VENDOR: [
    { prereqType: 'DATA', label: 'Vendor register and contract' },
    { prereqType: 'DATA', label: 'Latest vendor security questionnaire / SOC report' },
  ],
  CHANGE: [
    { prereqType: 'APPROVAL', label: 'CAB / emergency change approval' },
    { prereqType: 'WINDOW', label: 'Approved change window' },
    { prereqType: 'DATA', label: 'Tested rollback plan' },
  ],
  LOGGING: [
    { prereqType: 'ACCESS', label: 'Read access to SIEM / log platform' },
    { prereqType: 'DATA', label: 'List of privileged accounts in scope' },
  ],
};

/**
 * Carry React keys from the tree on screen onto a tree freshly built from the server, by
 * position, so refreshing local state after a save does not remount rows (and steal focus).
 */
export function adoptKeys(next, prev) {
  if (!prev) return next;
  const keep = (arr, old) => arr.map((x, i) => (old?.[i] ? { ...x, _key: old[i]._key } : x));
  return {
    prerequisites: keep(next.prerequisites, prev.prerequisites),
    escalations: keep(next.escalations, prev.escalations),
    rollbackSteps: keep(next.rollbackSteps, prev.rollbackSteps),
    sections: next.sections.map((s, si) => {
      const ps = prev.sections[si];
      if (!ps) return s;
      return {
        ...s,
        _key: ps._key,
        steps: s.steps.map((st, ti) => {
          const pst = ps.steps[ti];
          if (!pst) return st;
          return {
            ...st,
            _key: pst._key,
            _manualCode: pst._manualCode,
            evidenceReqs: keep(st.evidenceReqs, pst.evidenceReqs),
          };
        }),
      };
    }),
  };
}

/**
 * Mirrors the tenant backend's structural save validation (RunbookLintService.validate) so
 * autosave does not fire requests that are certain to 400 while a row is half-filled.
 * Returns the first problem as a message, or ''.
 */
export function treeProblem(tree) {
  for (const p of tree.prerequisites) if (!p.label.trim()) return 'every prerequisite needs a label (step 2).';
  const codes = new Set();
  for (const s of tree.sections) {
    if (!s.title.trim()) return 'every section needs a title (step 3).';
    for (const st of s.steps) {
      if (!st.title.trim()) return 'every step needs a title (step 3).';
      if (!st.instructionMd.trim()) return `step ${st.stepCode} needs an instruction (step 3).`;
      const c = (st.stepCode || '').trim();
      if (c && codes.has(c)) return `step code ${c} is used twice (step 3).`;
      codes.add(c);
      if (st.evidenceReqs.some((e) => e.mandatory && !e.label.trim())) {
        return `mandatory evidence on step ${st.stepCode} needs a label (step 3).`;
      }
    }
  }
  const esc = escalationProblem(tree.escalations);
  if (esc) return `${esc} (step 4).`;
  if (tree.escalations.some((e) => !e.notifyRole && e.notifyUserId == null)) return 'every escalation level must notify a role (step 4).';
  for (const r of tree.rollbackSteps) {
    if (!r.title.trim()) return 'every rollback step needs a title (step 4).';
    if (!r.instructionMd.trim()) return `rollback step "${r.title}" needs an instruction (step 4).`;
  }
  return '';
}
