import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ACTIVE_EXECUTION_STATUSES, EXECUTION_STATUS_COLOR, STEP_STATUS_COLOR, TERMINAL_STEP_STATUSES, humanize,
} from '../../../pages/runbooks/runbookConstants';

// MUI palette colour (runbookConstants) → Thirdline StatusBadge tone.
const MUI_TO_TONE = { default: 'gray', info: 'blue', warning: 'orange', error: 'red', success: 'green' };
export const execTone = (status) => MUI_TO_TONE[EXECUTION_STATUS_COLOR[status]] || 'gray';
export const stepTone = (status) => MUI_TO_TONE[STEP_STATUS_COLOR[status]] || 'gray';
export const outcomeTone = (outcome) => (outcome === 'PASS' ? 'green' : outcome === 'FAIL' ? 'red' : 'gray');

export const isActiveExecution = (status) => ACTIVE_EXECUTION_STATUSES.includes(status);
export const isTerminalStep = (status) => TERMINAL_STEP_STATUSES.includes(status);
// Statuses in which steps can be worked (start / pass / fail / skip / evidence / verify).
export const WORKABLE_EXECUTION_STATUSES = ['IN_PROGRESS', 'ESCALATED', 'ROLLING_BACK'];
export const TERMINAL_EXECUTION_STATUSES = ['COMPLETED_PASS', 'COMPLETED_FAIL', 'ABORTED'];

export const executionKey = (execId) => ['runbook-execution', String(execId)];
export const executionTimelineKey = (execId) => ['runbook-execution-timeline', String(execId)];
export const EXECUTIONS_KEY = ['runbook-executions'];

/**
 * Every execution mutation returns ExecutionDetailDto: write it straight into the by-id cache
 * (no refetch round trip) and invalidate the register/stats + timeline.
 */
export function useApplyExecution(execId) {
  const queryClient = useQueryClient();
  return (data) => {
    if (data && typeof data === 'object' && data.executionId != null) {
      queryClient.setQueryData(executionKey(execId), data);
    } else {
      queryClient.invalidateQueries({ queryKey: executionKey(execId) });
    }
    queryClient.invalidateQueries({ queryKey: EXECUTIONS_KEY });
    queryClient.invalidateQueries({ queryKey: executionTimelineKey(execId) });
    return data;
  };
}

/** Ticks every `intervalMs` — the only source of "now" for live countdowns (no refetching). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const pad = (n) => String(n).padStart(2, '0');

/** 3d 04:05:06 / 04:05:06 — absolute value; caller decides the "overdue" wording. */
export function formatCountdown(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** Compact duration, e.g. "2h 15m", "3d 4h", "45s". */
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '–';
  const total = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total % 60}s`;
}

export function formatDateTime(v) {
  if (!v) return '–';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const shortHash = (h) => (h ? `${h.slice(0, 12)}…` : '–');

export const statusLabel = (s) => humanize(s);

/** Steps grouped by section (in order), rollback steps last under "Rollback". */
export function groupSteps(steps = []) {
  const groups = [];
  const byKey = new Map();
  steps.forEach((s) => {
    const key = s.rollback ? '__rollback' : (s.sectionTitle || s.sectionType || 'Steps');
    if (!byKey.has(key)) {
      const g = { key, title: s.rollback ? 'Rollback' : key, rollback: !!s.rollback, steps: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).steps.push(s);
  });
  // Rollback group always last.
  return [...groups.filter((g) => !g.rollback), ...groups.filter((g) => g.rollback)];
}

/** Ordered flat list matching the grouped display order. */
export const orderedSteps = (steps = []) => groupSteps(steps).flatMap((g) => g.steps);

export function errorMessage(e, fallback = 'Something went wrong.') {
  return e?.message || e?.error || fallback;
}
