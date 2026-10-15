import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Chip, CircularProgress, Alert, Divider, Typography } from '@mui/material';
import {
  DetailHeader, StatusBadge, TL, CalendarDaysIcon, UserGroupIcon, ScaleIcon, ClipboardDocumentListIcon,
  LinkIcon, FolderIcon,
} from 'shared';
import api from '../../../services/api';
import { Section, Field as KitField, FieldGrid, MonoChip } from './detail/detailKit';

const FREQUENCY_TONE = {
  Daily: 'red',
  Weekly: 'orange',
  Monthly: 'blue',
  Quarterly: 'teal',
  Biannual: 'purple',
  Annual: 'green',
  Adhoc: 'gray',
  'Ad-hoc': 'gray',
  Event: 'purple',
};

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Field({ label, value, mono }) {
  return <KitField label={label} value={value} mono={mono} />;
}

function TextBlock({ icon, title, body }) {
  return (
    <Section icon={icon} title={title}>
      {body
        ? <Typography sx={{ fontSize: '0.875rem', color: TL.gray700, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{body}</Typography>
        : <Typography sx={{ fontSize: '0.875rem', color: TL.gray400, fontStyle: 'italic' }}>Not recorded</Typography>}
    </Section>
  );
}

export default function ReturnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ret, setRet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.platform.returns.get(id)
      .then((data) => { if (active) setRet(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !ret) {
    return (
      <Box>
        <DetailHeader band title="Return" onBack={() => navigate('/admin/returns')} backLabel="Back to Returns" />
        <Alert severity="error">{error || 'Return not found'}</Alert>
      </Box>
    );
  }

  const freqTone = FREQUENCY_TONE[ret.frequencyType] || 'gray';

  return (
    <Box>
      <DetailHeader
        band
        onBack={() => navigate('/admin/returns')}
        backLabel="Back to Returns"
        title={ret.title}
        meta={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <MonoChip label={ret.sectionReference} />
            {ret.frequencyType && <StatusBadge label={ret.frequencyType} tone={freqTone} />}
            {ret.frequency && <Chip size="small" variant="outlined" label={ret.frequency} />}
            {ret.actName && (
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 500, fontSize: '0.875rem' }}>
                <LinkIcon size={14} />
                {ret.actName}{ret.actAbbreviation ? ` (${ret.actAbbreviation})` : ''}
              </Typography>
            )}
          </Box>
        )}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, alignItems: 'start' }}>
        <Box>
          <TextBlock icon={<CalendarDaysIcon />} title="Deadline" body={ret.deadline} />
          <TextBlock icon={<ScaleIcon />} title="Statutory Basis" body={ret.statutoryBasis} />
          <TextBlock icon={<ClipboardDocumentListIcon />} title="Remarks" body={ret.remarks} />
        </Box>

        <Section icon={<UserGroupIcon />} title="Ownership">
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Field label="Responsible Unit" value={ret.responsibleUnit || 'Unassigned'} />
            <Field label="Responsible Person" value={ret.responsiblePerson} />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Field label="Last Filing Date" value={formatDt(ret.filingDate)} />
        </Section>
      </Box>

      <Section icon={<FolderIcon />} title="Record">
        <FieldGrid min={150}>
          <Field label="Return ID" value={ret.returnId} mono />
          <Field label="Act ID" value={ret.actId} mono />
          <Field label="Instrument ID" value={ret.instrumentId} mono />
          <Field label="Created" value={formatDt(ret.createdAt)} />
        </FieldGrid>
      </Section>
    </Box>
  );
}
