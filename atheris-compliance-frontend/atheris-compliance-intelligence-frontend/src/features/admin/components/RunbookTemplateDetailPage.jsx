import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Alert, Paper, Chip, Tooltip } from '@mui/material';
import {
  DetailHeader, CoverageStrip, RiskBadge, StatusBadge, TL,
  ListBulletIcon, Squares2x2Icon, ClockIcon, DocumentCheckIcon, ExclamationTriangleIcon, ArrowPathIcon,
} from 'shared';
import api from '../../../services/api';
import { ROUTES } from '../../../utils/constants';
import {
  categoryLabel, criticalityLabel, humanize, formatSla, formatDateTime, SECTION_LABEL, COMMAND_LANG_LABEL,
} from './runbookTemplateLabels';

const arr = (v) => (Array.isArray(v) ? v : []);

const monoChipSx = {
  fontFamily: TL.mono, fontSize: '0.7rem', height: 22, borderRadius: '4px',
};

function SectionCard({ title, count, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: '12px' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 1.5 }}>
        {title}{count != null && <Box component="span" sx={{ color: TL.gray500, fontWeight: 400 }}> ({count})</Box>}
      </Typography>
      {children}
    </Paper>
  );
}

function MetaGrid({ items }) {
  const shown = items.filter(([, v]) => v !== undefined && v !== null && v !== '');
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: '4px 16px' }}>
      {shown.map(([k, v]) => (
        <Box key={k} sx={{ display: 'contents' }}>
          <Typography variant="body2" sx={{ color: TL.gray500 }}>{k}</Typography>
          <Typography variant="body2" component="div">{v}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function ClauseChips({ clauses }) {
  if (!arr(clauses).length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {arr(clauses).map((c) => {
        const label = [c.framework, c.clauseRef].filter(Boolean).join(' ');
        return <Chip key={label} label={label} size="small" variant="outlined" sx={monoChipSx} />;
      })}
    </Box>
  );
}

function CommandBlock({ code, lang }) {
  if (!code) return null;
  const langLabel = COMMAND_LANG_LABEL[lang] ?? lang;
  return (
    <Box sx={{ mt: 1, border: `1px solid ${TL.gray200}`, borderRadius: '8px', overflow: 'hidden' }}>
      {langLabel && (
        <Box sx={{ px: 1.5, py: 0.5, bgcolor: TL.gray100, borderBottom: `1px solid ${TL.gray200}`,
          fontSize: '0.7rem', fontWeight: 600, color: TL.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {langLabel}
        </Box>
      )}
      <Box component="pre" sx={{
        m: 0, p: 1.5, bgcolor: TL.gray50, fontFamily: TL.mono, fontSize: '0.78rem', lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto',
      }}>
        {code}
      </Box>
    </Box>
  );
}

function Prose({ text, sx }) {
  if (!text) return null;
  return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', ...sx }}>{text}</Typography>;
}

function StepCard({ step }) {
  const evidence = arr(step.evidenceReqs);
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: '10px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        <Chip label={step.stepCode || '—'} size="small" variant="outlined" sx={monoChipSx} />
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, minWidth: 200 }}>{step.title}</Typography>
        {step.assignedRole && <StatusBadge label={humanize(step.assignedRole)} tone="blue" />}
        {step.blocking && <StatusBadge label="Blocking" tone="red" title="The run cannot proceed until this step passes" />}
        {step.dualControl && <StatusBadge label="Dual control" tone="purple" title="A second person must verify this step" />}
        {step.allowSkip && <StatusBadge label="Skippable" tone="gray" />}
        {step.durationEstimateMin != null && (
          <Typography variant="caption" sx={{ color: TL.gray500 }}>~{step.durationEstimateMin} min</Typography>
        )}
      </Box>

      <Prose text={step.instructionMd} />
      <CommandBlock code={step.commandBlock} lang={step.commandLang} />

      {step.expectedResult && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: TL.gray500, fontWeight: 600 }}>Expected result</Typography>
          <Prose text={step.expectedResult} />
        </Box>
      )}

      {step.safetyNote && (
        <Alert severity="warning" icon={<ExclamationTriangleIcon size={18} />} sx={{ mt: 1, py: 0 }}>
          {step.safetyNote}
        </Alert>
      )}

      {(evidence.length > 0 || arr(step.clauses).length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
          {evidence.map((e, i) => (
            <Tooltip key={`${e.evidenceType}-${i}`}
              title={`${humanize(e.evidenceType)}${e.mandatory ? ' · mandatory' : ' · optional'}${e.retentionYears ? ` · retain ${e.retentionYears} yrs` : ''}`}>
              <Chip size="small" icon={<DocumentCheckIcon size={14} />}
                label={e.label || humanize(e.evidenceType)}
                color={e.mandatory ? 'primary' : 'default'} variant={e.mandatory ? 'filled' : 'outlined'}
                sx={{ height: 22, fontSize: '0.72rem' }} />
            </Tooltip>
          ))}
          <ClauseChips clauses={step.clauses} />
        </Box>
      )}
    </Paper>
  );
}

export default function RunbookTemplateDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const { data: tpl, isLoading, error } = useQuery({
    queryKey: ['runbook-template', String(code)],
    queryFn: ({ signal }) => api.platform.runbookTemplates.get(code, signal),
    enabled: !!code,
  });

  const back = () => navigate(ROUTES.ADMIN_RUNBOOK_TEMPLATES);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (error || !tpl) {
    return (
      <Box>
        <DetailHeader band title="Runbook template" onBack={back} backLabel="Back to Runbook Templates" />
        <Alert severity="error">{error?.message || 'Runbook template not found'}</Alert>
      </Box>
    );
  }

  const content = tpl.content || {};
  const sections = arr(content.sections);
  const prerequisites = arr(content.prerequisites);
  const escalations = [...arr(content.escalations)].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const rollback = arr(content.rollback);
  const evidenceCount = sections.reduce((n, s) => n + arr(s.steps).reduce((m, st) => m + arr(st.evidenceReqs).length, 0), 0);

  const coverage = [
    { key: 'sections', label: 'Sections', value: tpl.sectionCount ?? sections.length, tone: 'blue', icon: <Squares2x2Icon /> },
    { key: 'steps', label: 'Steps', value: tpl.stepCount ?? 0, tone: 'purple', icon: <ListBulletIcon /> },
    { key: 'evidence', label: 'Evidence items', value: evidenceCount, tone: 'green', icon: <DocumentCheckIcon /> },
    { key: 'escalations', label: 'Escalation levels', value: escalations.length, tone: 'orange', icon: <ExclamationTriangleIcon /> },
    { key: 'rollback', label: 'Rollback steps', value: rollback.length, tone: 'red', icon: <ArrowPathIcon /> },
  ];

  return (
    <Box>
      <DetailHeader
        onBack={back}
        band
        backLabel="Back to Runbook Templates"
        title={tpl.title}
        status={tpl.status ? humanize(tpl.status) : undefined}
        statusTone={tpl.status === 'PUBLISHED' ? 'green' : 'gray'}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: TL.mono, fontSize: '0.8rem', color: TL.gray600 }}>
              {tpl.templateCode} · v{tpl.templateVersion ?? 1}
            </Typography>
            <RiskBadge value={criticalityLabel(tpl.criticality)} />
            <StatusBadge label={categoryLabel(tpl.category)} tone="blue" />
          </Box>
        )}
        description={tpl.objective}
      />

      <Box sx={{ mb: 3, width: '100%' }}>
        <CoverageStrip title="At a glance" items={coverage} />
      </Box>

      <SectionCard title="Details">
        <MetaGrid items={[
          ['Category', categoryLabel(tpl.category)],
          ['Criticality', criticalityLabel(tpl.criticality)],
          ['Frequency', humanize(tpl.frequency)],
          ['SLA', tpl.slaMinutes != null ? (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <ClockIcon size={14} />{formatSla(tpl.slaMinutes)}
            </Box>
          ) : null],
          ['Review cadence', humanize(content.reviewCadence)],
          ['Scope systems', arr(content.scopeSystems).join(', ')],
          ['Scope teams', arr(content.scopeTeams).join(', ')],
          ['Tags', arr(content.tags).length ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {arr(content.tags).map((t) => <Chip key={t} label={t} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />)}
            </Box>
          ) : null],
          ['Published', formatDateTime(tpl.publishedAt)],
          ['Last updated', formatDateTime(tpl.updatedAt)],
          ['Content hash', tpl.contentHash ? (
            <Tooltip title={tpl.contentHash}>
              <Box component="span" sx={{ fontFamily: TL.mono, fontSize: '0.75rem' }}>{tpl.contentHash.slice(0, 16)}…</Box>
            </Tooltip>
          ) : null],
        ]} />
      </SectionCard>

      <SectionCard title="Framework clauses" count={arr(content.clauses).length}>
        {arr(content.clauses).length
          ? <ClauseChips clauses={content.clauses} />
          : <Typography variant="body2" color="text.secondary">No clauses mapped.</Typography>}
      </SectionCard>

      <SectionCard title="Prerequisites" count={prerequisites.length}>
        {prerequisites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No prerequisites.</Typography>
        ) : prerequisites.map((p, i) => (
          <Box key={`${p.label}-${i}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 0.75,
            borderTop: i ? `1px solid ${TL.gray100}` : 'none' }}>
            <StatusBadge label={humanize(p.prereqType)} tone="teal" sx={{ minWidth: 80, justifyContent: 'center' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {p.label}{p.mandatory && <Box component="span" sx={{ color: TL.error }}> *</Box>}
              </Typography>
              {p.detail && <Typography variant="caption" sx={{ color: TL.gray500 }}>{p.detail}</Typography>}
            </Box>
          </Box>
        ))}
      </SectionCard>

      {sections.map((s, si) => (
        <SectionCard key={`${s.sectionType}-${si}`}
          title={`${si + 1}. ${s.title || SECTION_LABEL[s.sectionType] || humanize(s.sectionType)}`}
          count={arr(s.steps).length}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, mt: -0.5 }}>
            <StatusBadge label={SECTION_LABEL[s.sectionType] || humanize(s.sectionType)} tone="gray" />
            {s.description && <Typography variant="body2" sx={{ color: TL.gray500 }}>{s.description}</Typography>}
          </Box>
          {arr(s.steps).map((st, i) => <StepCard key={`${st.stepCode}-${i}`} step={st} />)}
        </SectionCard>
      ))}

      <SectionCard title="Escalation ladder" count={escalations.length}>
        {escalations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No escalations defined.</Typography>
        ) : escalations.map((e, i) => (
          <Box key={`${e.level}-${i}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1,
            borderTop: i ? `1px solid ${TL.gray100}` : 'none' }}>
            <StatusBadge label={`L${e.level ?? i + 1}`} tone={(e.level ?? 1) >= 3 ? 'red' : (e.level ?? 1) === 2 ? 'orange' : 'amber'} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {humanize(e.triggerType)} → {humanize(e.notifyRole)}
                <Box component="span" sx={{ color: TL.gray500, fontWeight: 400 }}>
                  {' '}via {humanize(e.notifyChannel)}{e.waitMinutes ? ` after ${e.waitMinutes} min` : ''}
                </Box>
              </Typography>
              <Prose text={e.instructions} sx={{ color: TL.gray600 }} />
            </Box>
          </Box>
        ))}
      </SectionCard>

      <SectionCard title="Rollback steps" count={rollback.length}>
        {rollback.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No rollback steps.</Typography>
        ) : rollback.map((r, i) => (
          <Paper key={`${r.reversesStepCode}-${i}`} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: '10px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
              {r.reversesStepCode && (
                <Chip label={`reverses ${r.reversesStepCode}`} size="small" variant="outlined" sx={monoChipSx} />
              )}
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.title}</Typography>
            </Box>
            <Prose text={r.instructionMd} />
            <CommandBlock code={r.commandBlock} lang={r.commandLang} />
            {r.verification && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: TL.gray500, fontWeight: 600 }}>Verification</Typography>
                <Prose text={r.verification} />
              </Box>
            )}
          </Paper>
        ))}
      </SectionCard>
    </Box>
  );
}
