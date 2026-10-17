/**
 * Thirdline design tokens (lifted from the Thirdline Internal Audit app's CSS variables
 * and Tailwind classes) so both Atheris frontends render with the same visual language.
 */
export const TL = {
  primary: '#1A365D',
  primaryLight: '#2A4A7F',
  primaryDark: '#0F2340',
  accent: '#D4AF37',
  accentLight: '#E2C458',
  secondary: '#2D7D46',
  success: '#2D7D46',
  warning: '#DD6B20',
  error: '#C53030',
  info: '#319795',
  bg: '#F7FAFC',
  card: '#FFFFFF',
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  // Tailwind gray scale used throughout Thirdline
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  sidebarWidth: 260,
  topbarHeight: 64,
  font: 'Figtree, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  mono: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  cardShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
};

/**
 * Badge tones — Thirdline's `.badge-*` palette (Tailwind *-100 background, *-800 text,
 * *-500 dot). `tile` is the *-50 tint used behind stat-card icons.
 */
export const TONES = {
  red: { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444', tile: '#FEF2F2', value: '#B91C1C' },
  orange: { bg: '#FFEDD5', fg: '#9A3412', dot: '#F97316', tile: '#FFF7ED', value: '#C2410C' },
  amber: { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B', tile: '#FFFBEB', value: '#B45309' },
  yellow: { bg: '#FEF9C3', fg: '#854D0E', dot: '#EAB308', tile: '#FEFCE8', value: '#A16207' },
  green: { bg: '#DCFCE7', fg: '#15803D', dot: '#22C55E', tile: '#F0FDF4', value: '#15803D' },
  teal: { bg: '#CCFBF1', fg: '#115E59', dot: '#14B8A6', tile: '#F0FDFA', value: '#0F766E' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6', tile: '#EFF6FF', value: TL.primary },
  purple: { bg: '#F3E8FF', fg: '#6B21A8', dot: '#A855F7', tile: '#FAF5FF', value: '#7E22CE' },
  gray: { bg: '#F3F4F6', fg: '#374151', dot: '#9CA3AF', tile: '#F9FAFB', value: '#374151' },
};

/** Semantic aliases so callers can say `tone="danger"` instead of a hue. */
const ALIASES = {
  primary: 'blue', info: 'teal', danger: 'red', error: 'red', warning: 'orange',
  success: 'green', neutral: 'gray', default: 'gray', secondary: 'green',
};

export function tone(name) {
  return TONES[ALIASES[name] || name] || TONES.gray;
}

const RISK_TONE = {
  critical: 'red', 'very high': 'red', high: 'orange', moderate: 'yellow', medium: 'yellow',
  low: 'green', 'very low': 'green', minimal: 'green',
};

/** Tone for a risk label (Critical/High/Moderate|Medium/Low). Unknown → gray. */
export function riskTone(label) {
  return RISK_TONE[String(label || '').trim().toLowerCase()] || 'gray';
}

const STATUS_TONE = {
  active: 'green', published: 'green', current: 'green', completed: 'green', closed: 'green',
  remediated: 'green', submitted: 'green', approved: 'green', applicable: 'green', compliant: 'green',
  effective: 'green', valid: 'green', success: 'green', enabled: 'green', final: 'blue',
  open: 'orange', pending: 'amber', triage: 'amber', draft: 'gray', 'not started': 'gray',
  'under review': 'amber', under_review: 'amber', unclassified: 'gray', 'due date needed': 'amber',
  'in progress': 'blue', in_progress: 'blue', processing: 'blue', 'in remediation': 'blue', scheduled: 'blue',
  overdue: 'red', failed: 'red', rejected: 'red', withdrawn: 'red', revoked: 'red', expired: 'red',
  ineffective: 'red', 'non-compliant': 'red', escalated: 'red',
  superseded: 'gray', outdated: 'orange', inactive: 'gray', skipped: 'gray', not_applicable: 'gray',
  'not applicable': 'gray', disabled: 'gray', archived: 'gray',
};

/** Tone for a workflow/status label. Unknown → gray. */
export function statusTone(label) {
  return STATUS_TONE[String(label || '').trim().toLowerCase()] || 'gray';
}
