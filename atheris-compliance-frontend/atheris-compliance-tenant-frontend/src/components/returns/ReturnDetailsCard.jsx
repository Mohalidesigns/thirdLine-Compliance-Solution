import { useState } from 'react';
import { Box, Typography, Chip, Button, Tooltip, Link, Alert, CircularProgress } from '@mui/material';
import {
  Section, Field, FieldGrid,
} from '../detailKit';
import {
  CalendarIcon, LinkIcon, ExclamationTriangleIcon, ClipboardDocumentListIcon,
} from 'shared';
import { useNavigate } from 'react-router-dom';
import {
  responsibleUnits, responsiblePersons, dueRuleText, isEventDriven, formatDate,
  escalationLadder, statusBadge,
} from './returnCommon';

function Chips({ values }) {
  if (!values?.length) return <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>—</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {values.map((v) => <Chip key={v} size="small" variant="outlined" label={v} />)}
    </Box>
  );
}

export default function ReturnDetailsCard({ item, obligations, obligationsLoading, escalation, escalationLoading }) {
  const navigate = useNavigate();
  const [showObligations, setShowObligations] = useState(false);
  const ladder = escalationLadder(escalation?.levels);
  const eventDriven = isEventDriven(item);
  const currentStatus = item.hasOverdue ? 'Overdue' : item.currentStatus;

  return (
    <Box>
      <Section icon={<ClipboardDocumentListIcon />} title="Return details"
        >
        <FieldGrid min={180}>
          <Field label="Act" value={item.actName || 'No act recorded'} />
          <Field label="Regulator" value={item.filingRegulator} />
          <Field label="Frequency" value={eventDriven ? 'On event' : (item.frequency || item.frequencyType)} />
          <Field label="Due rule" value={dueRuleText(item)} />
          <Field label="Start preparing" value={item.prepDays != null ? `${item.prepDays} day(s) before due` : 'Default (5 days before due)'} />
          <Field label="Filing channel" value={item.filingChannel} />
          <Field label="Return owner" value={item.returnOwnerName} />
          <Field label="Responsible units"><Chips values={responsibleUnits(item)} /></Field>
          <Field label="Responsible persons"><Chips values={responsiblePersons(item)} /></Field>
          {item.deadlineText && <Field label="Regulator wording" value={item.deadlineText} />}
        </FieldGrid>
      </Section>

      <Section icon={<CalendarIcon />} title="Schedule & periods">
        <FieldGrid min={180}>
          <Field label="Current period" value={item.currentPeriod || (eventDriven ? 'On event' : '—')} />
          <Field label="Current due date" value={item.currentDueDate ? formatDate(item.currentDueDate) : '—'} />
          <Field label="Current status" value={currentStatus ? statusBadge(currentStatus) : '—'} />
          <Field label="Periods on record" value={item.totalInstances ?? 0} />
          <Field label="Overdue periods" value={item.overdueCount ?? 0} />
          <Field label="Due date needed" value={item.dueDateNeeded ? 'Yes' : 'No'} />
          {item.dueDateSource === 'user' && <Field label="Due rule source" value="Set by your team" />}
        </FieldGrid>
        {!eventDriven && (item.projectedInstances || []).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Next periods (projected)
            </Typography>
            {(item.projectedInstances || []).map((p) => (
              <Typography key={p.period} variant="body2" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                • {p.period} · due {formatDate(p.dueDate)}
              </Typography>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              The next period is created when the current one is accepted.
            </Typography>
          </Box>
        )}
        {item.dueDateNeeded && !eventDriven && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This return has no due rule yet, so no filing periods are generated. Use “Edit schedule” to set one.
          </Alert>
        )}
        {(item.linkedObligationCount ?? 0) === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This return is not linked to any obligation — its filing has no documented duty behind it.
          </Alert>
        )}
      </Section>

      {eventDriven && (
        <Section icon={<CalendarIcon />} title="Event trigger">
          <FieldGrid min={180}>
            <Field label="Trigger" value={item.eventTriggerLabel} />
            <Field label="Deadline mode" value={item.eventDeadlineMode} />
            <Field label="Deadline" value={item.eventDeadlineDays != null
              ? `${item.eventDeadlineDays} ${(item.eventDeadlineUnit || '').toLowerCase()} day(s)`
              : '—'} />
            <Field label="Recorded events" value={item.eventFilingCount ?? 0} />
            <Field label="Overdue events" value={item.eventOverdueCount ?? 0} />
          </FieldGrid>
          {!item.eventTriggerConfigured && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No trigger is configured, so no filing can be created from an event yet.
            </Alert>
          )}
        </Section>
      )}

      <Section icon={<ExclamationTriangleIcon />} title="Escalation">
        {escalationLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
        ) : !escalation || escalation.policyId == null ? (
          <Alert severity="info">No escalation policy applies to this return.</Alert>
        ) : (
          <>
            <FieldGrid min={180}>
              <Field label="Policy" value={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{escalation.policyName}</Typography>
                  {escalation.isDefault && <Chip size="small" variant="outlined" label="Default" />}
                </Box>
              )} />
              <Field label="Applies to" value={escalation.frequencyScope ? `${escalation.frequencyScope} returns` : 'All returns'} />
              <Field label="Remind before" value={escalation.reminderStartValue != null
                ? `${escalation.reminderStartValue} ${(escalation.reminderStartUnit || '').toLowerCase()} before due`
                : '—'} />
              <Field label="Repeat every" value={escalation.reminderRepeatValue != null
                ? `${escalation.reminderRepeatValue} ${(escalation.reminderRepeatUnit || '').toLowerCase()}`
                : '—'} />
              <Field label="Filing link in emails" value={escalation.sendLink ? 'Yes' : 'No'} />
            </FieldGrid>
            <Box sx={{ mt: 2 }}>
              <Typography variant="overline" color="text.secondary">Ladder (after the due date)</Typography>
              {ladder.length === 0
                ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>No escalation levels — overdue filings are not escalated.</Typography>
                : ladder.map((line) => (
                  <Typography key={line} variant="body2" sx={{ fontSize: '0.85rem', mt: 0.5 }}>• {line}</Typography>
                ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Individual filings can override this — open a filing and use its Escalation button.
            </Typography>
          </>
        )}
      </Section>

      <Section icon={<LinkIcon />} title={`Linked obligations (${obligations?.length ?? item.linkedObligationCount ?? 0})`}
        action={obligations?.length ? (
          <Button size="small" variant="text" onClick={() => setShowObligations((v) => !v)}>
            {showObligations ? 'Hide' : 'Show'}
          </Button>
        ) : null}>
        {obligationsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
        ) : !obligations?.length ? (
          <Alert severity="warning">This return is not linked to any obligation — its filing has no documented duty behind it.</Alert>
        ) : !showObligations ? (
          <Typography variant="body2" color="text.secondary">
            {obligations.length} linked obligation{obligations.length === 1 ? '' : 's'} — show to open them.
          </Typography>
        ) : (
          <Box>
            {obligations.map((o, i) => {
              const title = o.title || o.name || `Obligation #${o.obligationId}`;
              return (
                <Box key={o.obligationId ?? i} sx={{ py: 0.5 }}>
                  <Tooltip title={title.length > 70 ? title : ''} placement="right">
                    <Link component="button" type="button" underline="hover" variant="body2"
                      onClick={() => navigate(`/obligations/${o.obligationId}`)}
                      sx={{
                        display: 'block', textAlign: 'left', maxWidth: 720, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem',
                      }}>
                      {title}
                    </Link>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}
      </Section>
    </Box>
  );
}
