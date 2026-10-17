import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Skeleton, Snackbar, Step, StepButton, StepLabel, Stepper,
} from '@mui/material';
import { PageHeader, StatusBadge, ChevronRightIcon, DocumentCheckIcon, TL } from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { AUTHOR_ROLES, APPROVER_ROLES, RUNBOOK_STATUS_COLOR, humanize } from './runbookConstants';
import ObjectiveStep, { metaErrors } from '../../components/runbooks/builder/ObjectiveStep';
import PrerequisitesStep from '../../components/runbooks/builder/PrerequisitesStep';
import ProcedureStep from '../../components/runbooks/builder/ProcedureStep';
import EscalationRollbackStep from '../../components/runbooks/builder/EscalationRollbackStep';
import ReviewPublishStep from '../../components/runbooks/builder/ReviewPublishStep';
import {
  adoptKeys, allSteps, hasSecret, renumber, toSaveRequest, treeFromVersion, treeProblem,
} from '../../components/runbooks/builder/builderModel';

const STEPS = ['Objective & Scope', 'Prerequisites', 'Procedure', 'Escalation & Rollback', 'Review & Publish'];
const AUTOSAVE_MS = 2000;

const EMPTY_META = {
  title: '', category: '', criticality: 'MEDIUM', ownerUserId: null, frequency: 'ON_DEMAND',
  slaMinutes: '', objective: '', reviewCadence: 'ANNUAL', scopeSystems: [], scopeTeams: [], tags: [],
};

const numOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const metaFromRunbook = (rb) => ({
  title: rb.title || '',
  category: rb.category || '',
  criticality: rb.criticality || 'MEDIUM',
  ownerUserId: rb.ownerUserId ?? null,
  frequency: rb.frequency || 'ON_DEMAND',
  slaMinutes: rb.slaMinutes ?? '',
  objective: rb.objective || '',
  reviewCadence: rb.reviewCadence || 'ANNUAL',
  scopeSystems: rb.scopeSystems || [],
  scopeTeams: rb.scopeTeams || [],
  tags: rb.tags || [],
});
const metaPayload = (m) => ({
  title: m.title.trim(), category: m.category, criticality: m.criticality, ownerUserId: m.ownerUserId ?? null,
  frequency: m.frequency, slaMinutes: numOrNull(m.slaMinutes), objective: m.objective || null,
  scopeSystems: m.scopeSystems || [], scopeTeams: m.scopeTeams || [], tags: m.tags || [],
  reviewCadence: m.reviewCadence || null,
});
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function useUsers() {
  const q = useQuery({
    queryKey: ['runbooks', 'assignees'],
    queryFn: ({ signal }) => api.runbooks.assignees({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const users = useMemo(() => (q.data || []).filter((u) => u.isActive !== false), [q.data]);
  return { users, usersError: q.isError };
}

function WizardStepper({ active, onStep, disabledFrom = 99 }) {
  return (
    <Stepper nonLinear activeStep={active} alternativeLabel sx={{ py: 1 }}>
      {STEPS.map((label, i) => (
        <Step key={label} disabled={i >= disabledFrom}>
          {onStep && i < disabledFrom
            ? <StepButton onClick={() => onStep(i)}>{label}</StepButton>
            : <StepLabel>{label}</StepLabel>}
        </Step>
      ))}
    </Stepper>
  );
}

const stickySx = {
  position: 'sticky', top: TL.topbarHeight, zIndex: 5, bgcolor: TL.bg, mx: -1, px: 1, pb: 1, mb: 2,
  borderBottom: `1px solid ${TL.gray100}`,
};

// ============================================================================ /runbooks/new

function NewRunbook() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { users, usersError } = useUsers();
  const [meta, setMetaState] = useState(() => ({ ...EMPTY_META, ownerUserId: user?.userId ?? null }));
  const [touched, setTouched] = useState(false);
  const errors = metaErrors(meta);
  const canAuthor = AUTHOR_ROLES.includes(user?.role);

  const create = useMutation({
    mutationFn: () => api.runbooks.create({
      title: meta.title.trim(), category: meta.category, criticality: meta.criticality,
      ownerUserId: meta.ownerUserId ?? null, frequency: meta.frequency,
      slaMinutes: numOrNull(meta.slaMinutes), objective: meta.objective || null,
    }),
    onSuccess: (rb) => {
      queryClient.invalidateQueries({ queryKey: ['runbooks'] });
      queryClient.setQueryData(['runbook', String(rb.runbookId)], rb);
      navigate(`/runbooks/${rb.runbookId}/edit`, { replace: true });
    },
  });

  return (
    <>
      <PageHeader title="New runbook" subtitle="Step 1 — describe the runbook, then build its procedure."
        onBack={() => navigate('/runbooks')} backLabel="Runbooks" />
      <RunbooksNav />
      <Box sx={stickySx}><WizardStepper active={0} disabledFrom={1} /></Box>
      {!canAuthor && <Alert severity="warning" sx={{ mb: 2 }}>Your role cannot author runbooks.</Alert>}
      {create.isError && <Alert severity="error" sx={{ mb: 2 }}>{create.error.message}</Alert>}
      <ObjectiveStep isNew meta={meta} setMeta={(p) => setMetaState((m) => ({ ...m, ...p }))}
        errors={touched ? errors : {}} users={users} usersError={usersError} readOnly={!canAuthor} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
        <Button onClick={() => navigate('/runbooks')}>Cancel</Button>
        <Button variant="contained" disabled={create.isPending || !canAuthor}
          endIcon={create.isPending ? <CircularProgress size={14} color="inherit" /> : <ChevronRightIcon size={16} />}
          onClick={() => { setTouched(true); if (Object.keys(errors).length === 0) create.mutate(); }}>
          Create draft
        </Button>
      </Box>
    </>
  );
}

// ============================================================================ /runbooks/:id/edit

function EditRunbook({ id }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { users, usersError } = useUsers();
  const canAuthor = AUTHOR_ROLES.includes(user?.role);
  const canApprove = APPROVER_ROLES.includes(user?.role);
  const runbookKey = useMemo(() => ['runbook', String(id)], [id]);

  const runbookQ = useQuery({
    queryKey: runbookKey,
    queryFn: ({ signal }) => api.runbooks.get(id, { signal }),
  });
  const rb = runbookQ.data;

  // ---- which version is editable: the open draft, else create one (once), else read-only current
  const [createdVid, setCreatedVid] = useState(null);
  const draftRequested = useRef(false);
  const lockedRunbook = rb && (rb.status === 'DEPRECATED' || rb.status === 'ARCHIVED');
  const vid = createdVid || rb?.draftVersionId || ((lockedRunbook || !canAuthor) ? rb?.currentVersionId : null) || null;

  const createDraft = useMutation({
    mutationFn: () => api.runbooks.versions.createDraft(id),
    onSuccess: (v) => {
      queryClient.setQueryData([...runbookKey, 'version', String(v.versionId)], v);
      setCreatedVid(v.versionId);
      queryClient.invalidateQueries({ queryKey: runbookKey });
    },
  });
  useEffect(() => {
    if (!rb || vid || lockedRunbook || !canAuthor || draftRequested.current) return;
    draftRequested.current = true;
    createDraft.mutate();
  }, [rb, vid, lockedRunbook, canAuthor, createDraft]);

  const versionKey = useMemo(() => [...runbookKey, 'version', String(vid)], [runbookKey, vid]);
  const versionQ = useQuery({
    queryKey: versionKey,
    queryFn: ({ signal }) => api.runbooks.versions.get(id, vid, { signal }),
    enabled: !!vid,
    refetchOnWindowFocus: false,
  });
  const version = versionQ.data;
  const readOnly = !canAuthor || !version || version.status !== 'DRAFT' || !!lockedRunbook;

  // ---- local editable state (initialised once per runbook / version, never clobbered by refetches)
  const [meta, setMeta] = useState(EMPTY_META);
  const [metaTouched, setMetaTouched] = useState(false);
  const metaInit = useRef(false);
  useEffect(() => {
    if (rb && !metaInit.current) { metaInit.current = true; setMeta(metaFromRunbook(rb)); }
  }, [rb]);

  const [tree, setTree] = useState(null);
  const treeRef = useRef(null);
  const treeInitFor = useRef(null);
  useEffect(() => {
    if (version && treeInitFor.current !== version.versionId) {
      treeInitFor.current = version.versionId;
      const t = renumber(treeFromVersion(version));
      treeRef.current = t;
      setTree(t);
    }
  }, [version]);

  const [activeStep, setActiveStep] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const [lint, setLint] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error | blocked
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [stepErrors, setStepErrors] = useState({});
  const [snack, setSnack] = useState('');

  // edit counters: a save only clears "dirty" when nothing changed while it was in flight
  const treeSeq = useRef(0);
  const treeSaved = useRef(0);
  const metaSeq = useRef(0);
  const metaSaved = useRef(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const inflight = useRef(null);
  const [editTick, setEditTick] = useState(0); // bumps on user edits (drives autosave)
  const [, setTick] = useState(0); // re-render after a save settles (dirty is read from refs)
  const dirty = treeSeq.current !== treeSaved.current || metaSeq.current !== metaSaved.current;

  const updateTree = useCallback((patch) => {
    if (readOnly) return;
    setTree((t) => {
      const next = renumber({ ...t, ...patch });
      treeRef.current = next;
      return next;
    });
    treeSeq.current += 1;
    setEditTick((x) => x + 1);
  }, [readOnly]);

  const updateMeta = useCallback((patch) => {
    if (readOnly) return;
    setMeta((m) => { const next = { ...m, ...patch }; metaRef.current = next; return next; });
    metaSeq.current += 1;
    setEditTick((x) => x + 1);
  }, [readOnly]);

  const markSaved = () => { setSaveState('saved'); setSavedAt(new Date()); setSaveError(''); };

  const saveMeta = useCallback(async () => {
    if (readOnly || metaSeq.current === metaSaved.current) return true;
    const m = metaRef.current;
    if (Object.keys(metaErrors(m)).length) { setMetaTouched(true); return false; }
    const seq = metaSeq.current;
    const detail = await api.runbooks.update(id, metaPayload(m));
    metaSaved.current = seq;
    queryClient.setQueryData(runbookKey, detail);
    queryClient.invalidateQueries({ queryKey: ['runbooks'] });
    return true;
  }, [readOnly, id, queryClient, runbookKey]);

  const saveTree = useCallback(async () => {
    if (readOnly || !vid || !treeRef.current || treeSeq.current === treeSaved.current) return true;
    const problem = treeProblem(treeRef.current);
    if (problem) throw new Error(`Not saved yet — ${problem}`);
    const seq = treeSeq.current;
    try {
      const res = await api.runbooks.versions.save(id, vid, toSaveRequest(treeRef.current));
      treeSaved.current = seq;
      setStepErrors({});
      if (res?.lint) setLint(res.lint);
      if (res?.version) {
        queryClient.setQueryData(versionKey, res.version);
        if (treeSeq.current === seq) {
          // nothing edited while saving — adopt the server's copy (keeping row keys stable)
          const next = renumber(adoptKeys(treeFromVersion(res.version), treeRef.current));
          treeRef.current = next;
          setTree(next);
        }
      }
      return true;
    } catch (e) {
      // 400 secret_in_command: api.js surfaces only the message, so match its wording and
      // mark the offending step(s) — by the client L9 check and by the "Step <code>:" prefix.
      const m = e.message || '';
      if (/secret|password|token/i.test(m)) {
        const named = (m.match(/^Step\s+(\S+?):/) || [])[1];
        const errs = {};
        allSteps(treeRef.current).forEach(({ step }) => {
          if (hasSecret(step.commandBlock) || (named && step.stepCode === named)) errs[step._key] = m;
        });
        setStepErrors(errs);
        throw new Error(`Save rejected — ${m} Your local edits are kept.`);
      }
      throw e;
    }
  }, [readOnly, vid, id, queryClient, versionKey]);

  /** Save everything pending; serialised so saves never overlap. Resolves true when clean. */
  const flush = useCallback(async () => {
    if (inflight.current) { try { await inflight.current; } catch { /* reported already */ } }
    if (readOnly) return true;
    if (metaSeq.current === metaSaved.current && treeSeq.current === treeSaved.current) return true;
    const p = (async () => {
      setSaveState('saving');
      try {
        const okMeta = await saveMeta();
        const okTree = await saveTree();
        if (okMeta && okTree) markSaved();
        else { setSaveState('error'); setSaveError('Fix the highlighted fields in step 1 before saving.'); }
        return okMeta && okTree;
      } catch (e) {
        setSaveState(String(e.message).startsWith('Not saved yet') ? 'blocked' : 'error');
        setSaveError(e.message || 'Save failed.');
        return false;
      } finally {
        setTick((x) => x + 1);
      }
    })();
    inflight.current = p;
    try { return await p; } finally { if (inflight.current === p) inflight.current = null; }
  }, [readOnly, saveMeta, saveTree]);

  // ---- autosave: debounce after the last edit
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!dirty || readOnly) return undefined;
    const t = setTimeout(() => { flushRef.current(); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [editTick, dirty, readOnly]);
  // best effort on leaving the page
  useEffect(() => () => { flushRef.current(); }, []);
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---- clause mapping + links (discrete actions, saved immediately)
  const setClauses = useMutation({
    mutationFn: (ids) => api.runbooks.setClauses(id, ids),
    onSuccess: (detail) => { queryClient.setQueryData(runbookKey, detail); queryClient.invalidateQueries({ queryKey: ['runbooks'] }); },
    onError: (e) => setSnack(e.message),
  });
  const setLinks = useMutation({
    mutationFn: (links) => api.runbooks.setLinks(id, links),
    onSuccess: (detail) => { queryClient.setQueryData(runbookKey, detail); queryClient.invalidateQueries({ queryKey: ['runbooks'] }); },
    onError: (e) => setSnack(e.message),
  });

  // ---- lint / submit / publish
  const lintMut = useMutation({
    mutationFn: () => api.runbooks.versions.lint(id, vid),
    onSuccess: (r) => setLint(r),
    onError: (e) => setSnack(e.message),
  });
  const runLint = useCallback(async () => {
    if (!vid) return;
    if (!readOnly) await flush();
    lintMut.mutate();
  }, [vid, readOnly, flush, lintMut]);

  const finish = (msg) => {
    queryClient.invalidateQueries({ queryKey: runbookKey });
    queryClient.invalidateQueries({ queryKey: ['runbooks'] });
    navigate(`/runbooks/${id}`, { state: { flash: msg } });
  };
  const submit = useMutation({
    mutationFn: async () => {
      const ok = await flush();
      if (!ok) throw new Error('Save failed — fix the errors before submitting.');
      return api.runbooks.versions.submit(id, vid);
    },
    onSuccess: () => finish('Submitted for approval.'),
    onError: (e) => { setSnack(e.message); lintMut.mutate(); },
  });
  const publish = useMutation({
    mutationFn: async (changeSummary) => {
      const ok = await flush();
      if (!ok) throw new Error('Save failed — fix the errors before publishing.');
      return api.runbooks.versions.publish(id, vid, { changeSummary });
    },
    onSuccess: () => finish('Version published.'),
    onError: (e) => setSnack(e.message),
  });

  const goStep = (n) => {
    if (!readOnly) flush();
    setEditTarget(null);
    setActiveStep(n);
    if (n === 4) runLint();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpTo = (issue) => {
    const t = treeRef.current;
    let si = issue.sectionIndex;
    let ti = issue.stepIndex;
    if ((si == null || ti == null) && issue.stepCode && t) {
      const hit = allSteps(t).find(({ step }) => step.stepCode === issue.stepCode);
      if (hit) { si = hit.si; ti = hit.ti; }
    }
    if (si != null && ti != null && t?.sections[si]?.steps[ti]) {
      setActiveStep(2);
      setEditTarget({ si, ti, isNew: false });
      return;
    }
    if (issue.rule === 'L7') setActiveStep(0);
    else if (issue.rule === 'L6' || issue.rule === 'L10') setActiveStep(3);
    else setActiveStep(2);
    setEditTarget(null);
  };

  // ---- render
  if (runbookQ.isLoading) {
    return <Box><Skeleton height={80} /><Skeleton height={60} /><Skeleton variant="rounded" height={320} /></Box>;
  }
  if (runbookQ.isError) {
    return <Alert severity="error" action={<Button onClick={() => runbookQ.refetch()}>Retry</Button>}>{runbookQ.error.message}</Alert>;
  }

  const mappedClauses = rb?.clauses || [];
  const lintErrors = lint ? (lint.errors ?? 0) : null;
  const lintWarns = lint ? (lint.warnings ?? 0) : null;
  const metaErrs = metaTouched ? metaErrors(meta) : {};

  let readOnlyMsg = '';
  if (version && readOnly) {
    if (!canAuthor) readOnlyMsg = 'Your role can view runbooks but not edit them.';
    else if (lockedRunbook) readOnlyMsg = `This runbook is ${humanize(rb.status).toLowerCase()} and can no longer be edited.`;
    else if (version.status === 'IN_REVIEW') readOnlyMsg = `Version ${version.versionNumber} is awaiting approval and is read-only. A CCO or Tenant Admin can approve it or send it back for changes from Approvals.`;
    else readOnlyMsg = `Version ${version.versionNumber} is ${humanize(version.status).toLowerCase()} and is read-only.`;
  }

  const saveChip = readOnly ? null : saveState === 'saving'
    ? <Chip size="small" icon={<CircularProgress size={12} />} label="Saving…" />
    : saveState === 'error'
      ? <Chip size="small" color="error" label="Save failed" title={saveError} />
      : saveState === 'blocked'
        ? <Chip size="small" color="warning" label="Not saved — incomplete" title={saveError} />
      : dirty
        ? <Chip size="small" variant="outlined" label="Unsaved changes" />
        : savedAt ? <Chip size="small" variant="outlined" color="success" label={`Saved · ${hhmm(savedAt)}`} /> : null;

  return (
    <>
      <PageHeader
        title={meta.title || rb?.title || 'Runbook'}
        subtitle={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontFamily: TL.mono }}>{rb?.runbookCode}</Box>
            {version && <span>· Version {version.versionNumber}</span>}
            {version && <StatusBadge label={humanize(version.status)} tone={RUNBOOK_STATUS_COLOR[version.status] === 'warning' ? 'orange' : RUNBOOK_STATUS_COLOR[version.status] === 'success' ? 'green' : 'gray'} />}
          </Box>
        )}
        onBack={() => navigate(`/runbooks/${id}`)}
        backLabel="Runbook"
        actions={!readOnly && (
          <Button variant="outlined" startIcon={<DocumentCheckIcon size={16} />} disabled={saveState === 'saving'}
            onClick={() => flush().then((ok) => ok && setSnack('Draft saved.'))}>
            Save draft
          </Button>
        )}
      />
      <RunbooksNav />

      <Box sx={stickySx}>
        <WizardStepper active={activeStep} onStep={goStep} />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          {saveChip}
          {lint && (
            <Chip size="small" clickable onClick={() => goStep(4)}
              color={lintErrors > 0 ? 'error' : lintWarns > 0 ? 'warning' : 'success'}
              label={lintErrors > 0 || lintWarns > 0 ? `Lint · ${lintErrors} errors · ${lintWarns} warnings` : 'Lint clean'} />
          )}
        </Box>
      </Box>

      {createDraft.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>Could not open a draft version: {createDraft.error.message}</Alert>
      )}
      {readOnlyMsg && <Alert severity="info" sx={{ mb: 2 }}>{readOnlyMsg}</Alert>}
      {(saveState === 'error' || saveState === 'blocked') && saveError && (
        <Alert severity={saveState === 'blocked' ? 'warning' : 'error'} sx={{ mb: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}
      {Object.keys(metaErrs).length > 0 && activeStep !== 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button size="small" onClick={() => setActiveStep(0)}>Fix</Button>}>
          Step 1 has invalid fields; runbook details are not being saved.
        </Alert>
      )}

      {(!vid || !version || !tree) && activeStep !== 0 ? (
        versionQ.isError
          ? <Alert severity="error">{versionQ.error.message}</Alert>
          : <Skeleton variant="rounded" height={320} />
      ) : (
        <>
          {activeStep === 0 && (
            <ObjectiveStep meta={meta} setMeta={updateMeta} errors={metaErrs} readOnly={readOnly}
              users={users} usersError={usersError} runbook={rb}
              onClausesChange={(ids) => setClauses.mutate(ids)}
              onLinksChange={(links) => setLinks.mutate(links)}
              linkBusy={setClauses.isPending || setLinks.isPending} />
          )}
          {activeStep === 1 && tree && (
            <PrerequisitesStep items={tree.prerequisites} onChange={(prerequisites) => updateTree({ prerequisites })}
              category={meta.category} readOnly={readOnly} />
          )}
          {activeStep === 2 && tree && (
            <ProcedureStep sections={tree.sections} onChange={(sections) => updateTree({ sections })}
              readOnly={readOnly} mappedClauses={mappedClauses} editTarget={editTarget} setEditTarget={setEditTarget}
              serverIssues={lint?.issues || []} stepErrors={stepErrors} />
          )}
          {activeStep === 3 && tree && (
            <EscalationRollbackStep tree={tree} onChange={updateTree} readOnly={readOnly}
              criticality={meta.criticality} slaMinutes={numOrNull(meta.slaMinutes)} />
          )}
          {activeStep === 4 && tree && (
            <ReviewPublishStep meta={meta} tree={tree} lint={lint} linting={lintMut.isPending} onRelint={runLint}
              onJump={jumpTo} readOnly={readOnly} saving={saveState === 'saving'} dirty={dirty}
              onSaveDraft={() => flush().then((ok) => ok && setSnack('Draft saved.'))}
              onSubmit={() => submit.mutate()} submitting={submit.isPending}
              canPublishRole={canApprove} onPublish={(s) => publish.mutate(s)} publishing={publish.isPending} />
          )}
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={activeStep === 0} onClick={() => goStep(activeStep - 1)}>Back</Button>
        {activeStep < STEPS.length - 1 && (
          <Button variant="contained" endIcon={<ChevronRightIcon size={16} />} onClick={() => goStep(activeStep + 1)}>
            Next: {STEPS[activeStep + 1]}
          </Button>
        )}
      </Box>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </>
  );
}

export default function RunbookBuilderPage() {
  const { id } = useParams();
  if (!id) return <NewRunbook />;
  return <EditRunbook key={id} id={id} />;
}
