import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import {
  DetailHeader, SectionTabs, StatusBadge, RiskBadge, TL,
  ArrowPathIcon, PlusIcon, ScaleIcon, DocumentTextIcon, ClockIcon, ShieldCheckIcon, ListBulletIcon,
} from 'shared';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RunbooksNav from '../../components/runbooks/RunbooksNav';
import { Section, Field, FieldGrid, CARD_SX } from '../../components/detailKit';
import AdoptTemplateDialog from '../../components/runbooks/AdoptTemplateDialog';
import { StepsView, PrerequisitesView, EscalationRollbackView } from '../../components/runbooks/DetailVersionView';
import {
  AUTHOR_ROLES, CATEGORIES, FREQUENCIES, areaOfFocus, humanize, label, formatMinutes,
} from './runbookConstants';

const arr = (v) => (Array.isArray(v) ? v : []);

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ChipRow({ items, empty = 'None' }) {
  if (!items?.length) return <Typography variant="body2" color="text.secondary">{empty}</Typography>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {items.map((t) => <Chip key={t} size="small" label={t} sx={{ height: 22 }} />)}
    </Box>
  );
}

function AdoptionBadge({ t }) {
  if (!t.adopted) return <StatusBadge label="Not adopted" tone="gray" />;
  if (t.updateAvailable) {
    return <StatusBadge label={`Update available (v${t.templateVersion})`} tone="amber"
      title={`Adopted v${t.adoptedTemplateVersion ?? '?'}; platform now at v${t.templateVersion}`} />;
  }
  return <StatusBadge label={`Adopted v${t.adoptedTemplateVersion ?? t.templateVersion}`} tone="green" />;
}

function CountTile({ icon, label: lbl, value }) {
  return (
    <Box sx={{ ...CARD_SX, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box sx={{ color: TL.gray400, display: 'flex', '& svg': { width: 16, height: 16 } }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</Typography>
      </Box>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: TL.textPrimary }}>{value}</Typography>
    </Box>
  );
}

export default function TemplateDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdopt = AUTHOR_ROLES.includes(user?.role);

  const [tab, setTab] = useState('overview');
  const [adoptOpen, setAdoptOpen] = useState(false);

  const query = useQuery({
    queryKey: ['runbook-template', String(code)],
    queryFn: ({ signal }) => api.runbooks.templates.get(code, { signal }),
    enabled: !!code,
  });
  const tpl = query.data;
  const content = useMemo(() => tpl?.content || {}, [tpl]);

  if (query.isPending) {
    return (
      <Box>
        <RunbooksNav />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      </Box>
    );
  }
  if (query.error || !tpl) {
    return (
      <Box>
        <RunbooksNav />
        <Alert severity="error" sx={{ mb: 2 }}>{query.error?.message || 'Runbook template not found.'}</Alert>
        <Button onClick={() => navigate('/runbooks/templates')}>Back to Runbook Templates</Button>
      </Box>
    );
  }

  const sections = arr(content.sections);
  const prerequisites = arr(content.prerequisites);
  const escalations = arr(content.escalations);
  const rollback = arr(content.rollback);
  const clauses = arr(content.clauses);
  const stepCount = tpl.stepCount ?? sections.reduce((n, s) => n + arr(s.steps).length, 0);
  const evidenceCount = sections.reduce((n, s) => n + arr(s.steps).reduce((m, st) => m + arr(st.evidenceReqs).length, 0), 0);

  const meta = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontFamily: TL.mono, fontSize: '0.8125rem', color: TL.gray500 }}>
        {tpl.templateCode}{tpl.templateVersion != null ? ` · v${tpl.templateVersion}` : ''}
      </Typography>
      <RiskBadge value={humanize(tpl.criticality)} />
      <StatusBadge label={label(CATEGORIES, tpl.category)} tone="teal" />
      <StatusBadge label={label(FREQUENCIES, tpl.frequency)} tone="gray" />
      <AdoptionBadge t={tpl} />
      <Typography variant="body2" sx={{ color: TL.gray500 }}>
        Area of focus: <b>{areaOfFocus(tpl.category)}</b>
        {' · '}SLA: <b>{tpl.slaMinutes != null ? formatMinutes(tpl.slaMinutes) : 'none'}</b>
      </Typography>
    </Box>
  );

  const right = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Tooltip title="Refresh">
        <Box component="span">
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => query.refetch()}>Refresh</Button>
        </Box>
      </Tooltip>
      {tpl.adopted && tpl.adoptedRunbookId != null && (
        <Button variant="outlined" onClick={() => navigate(`/runbooks/${tpl.adoptedRunbookId}`)}>Open runbook</Button>
      )}
      {!tpl.adopted && canAdopt && (
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setAdoptOpen(true)}>Adopt template</Button>
      )}
      {!tpl.adopted && !canAdopt && (
        <Typography variant="caption" color="text.secondary">Only an Analyst, CCO or Tenant Admin can adopt.</Typography>
      )}
    </Box>
  );

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'steps', label: 'Steps', count: stepCount },
    { key: 'prereqs', label: 'Prerequisites', count: prerequisites.length },
    { key: 'escalation', label: 'Escalation & Rollback', count: escalations.length + rollback.length },
    { key: 'mapping', label: 'Framework Mapping', count: clauses.length },
  ];

  const overview = (
    <>
      <Section icon={<DocumentTextIcon />} title="Objective">
        <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.7, color: content.objective || tpl.objective ? TL.gray700 : TL.gray400, fontStyle: tpl.objective ? 'normal' : 'italic' }}>
          {tpl.objective || 'No objective recorded.'}
        </Typography>
      </Section>

      <Section icon={<ClockIcon />} title="Details">
        <FieldGrid>
          <Field label="Category" value={label(CATEGORIES, tpl.category)} />
          <Field label="Area of focus" value={areaOfFocus(tpl.category)} />
          <Field label="Criticality" value={humanize(tpl.criticality)} />
          <Field label="Frequency" value={label(FREQUENCIES, tpl.frequency)} />
          <Field label="SLA" value={tpl.slaMinutes != null ? formatMinutes(tpl.slaMinutes) : 'None'} />
          <Field label="Review cadence" value={content.reviewCadence ? label(FREQUENCIES, content.reviewCadence) : '—'} />
          <Field label="Template version" value={tpl.templateVersion != null ? `v${tpl.templateVersion}` : '—'} />
          <Field label="Adoption">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <AdoptionBadge t={tpl} />
              {tpl.adoptedRunbookId != null && tpl.updateAvailable && (
                <Button size="small" onClick={() => navigate(`/runbooks/${tpl.adoptedRunbookId}`)}>Review update</Button>
              )}
            </Box>
          </Field>
          <Field label="Last updated" value={formatDate(tpl.updatedAt)} />
        </FieldGrid>
      </Section>

      <Section icon={<ShieldCheckIcon />} title="Scope">
        <FieldGrid min={220}>
          <Field label="Systems"><ChipRow items={content.scopeSystems} /></Field>
          <Field label="Teams"><ChipRow items={content.scopeTeams} /></Field>
          <Field label="Tags"><ChipRow items={content.tags} /></Field>
        </FieldGrid>
      </Section>

      <Section icon={<ListBulletIcon />} title="At a glance">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' } }}>
          <CountTile icon={<ListBulletIcon />} label="Sections" value={tpl.sectionCount ?? sections.length} />
          <CountTile icon={<ListBulletIcon />} label="Steps" value={stepCount} />
          <CountTile icon={<DocumentTextIcon />} label="Evidence items" value={evidenceCount} />
          <CountTile icon={<ShieldCheckIcon />} label="Escalation levels" value={escalations.length} />
          <CountTile icon={<ScaleIcon />} label="Clauses" value={clauses.length} />
        </Box>
      </Section>
    </>
  );

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/runbooks/templates')}
        backLabel="Runbook Templates"
        title={tpl.title}
        meta={meta}
        right={right}
      />

      <RunbooksNav />

      {tpl.adopted && tpl.updateAvailable && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={tpl.adoptedRunbookId != null && (
            <Button color="inherit" size="small" onClick={() => navigate(`/runbooks/${tpl.adoptedRunbookId}`)}>Review update</Button>
          )}>
          Template updated to v{tpl.templateVersion} — your runbook was adopted from v{tpl.adoptedTemplateVersion ?? '?'}.
          Open the runbook to review the changes and create a revision.
        </Alert>
      )}

      <SectionTabs tabs={tabs} value={tab} onChange={setTab} sx={{ mb: 3 }} />

      {tab === 'overview' && overview}
      {tab === 'steps' && <StepsView tree={{ sections }} clausesById={new Map()} />}
      {tab === 'prereqs' && <PrerequisitesView tree={{ prerequisites }} />}
      {tab === 'escalation' && <EscalationRollbackView tree={{ escalations, rollbackSteps: rollback }} />}
      {tab === 'mapping' && (
        <Section icon={<ScaleIcon />} title="Framework clauses"
          subtitle={`${clauses.length} clause${clauses.length === 1 ? '' : 's'} mapped`}
          contentSx={{ p: 0 }}>
          {clauses.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No clauses mapped — runbooks without clauses do not count towards coverage.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Framework</TableCell>
                  <TableCell>Clause</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clauses.map((c, i) => (
                  <TableRow key={`${c.framework}-${c.clauseRef}-${i}`}>
                    <TableCell><Chip size="small" label={c.framework} sx={{ height: 22 }} /></TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={c.clauseRef}
                        sx={{ height: 22, fontFamily: TL.mono, fontSize: '0.7rem' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}

      <AdoptTemplateDialog
        open={adoptOpen}
        template={tpl}
        onClose={() => setAdoptOpen(false)}
      />
    </Box>
  );
}
