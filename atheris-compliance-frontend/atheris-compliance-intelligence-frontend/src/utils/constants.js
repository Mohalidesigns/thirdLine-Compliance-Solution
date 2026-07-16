export const BRAND = {
  NAME: 'Atheris',
  TAGLINE: 'Compliance Intelligence Hub',
  SUBTAGLINE: "Africa's Premier Compliance Intelligence Platform",
  SECURITY_NOTICE: 'Secured with AES-256 encryption & NDPA 2023 compliance',
};

export const APP = {
  INITIALS: 'AH',
  DRAWER_WIDTH: 260,
  TOPBAR_HEIGHT: 56,
  API_BASE: 'http://localhost:9090/api/v1',
  DEMO_TOKEN: 'demo-jwt-token',
};

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  LIBRARY: '/library',
  INBOX: '/inbox',
  WATCHLIST: '/watchlist',
  SETTINGS_API: '/settings/api',
  SETTINGS_COMPLIANCE: '/settings/compliance',
  ACTIVATE_LICENSE: '/activate-license',
  ONBOARDING: '/onboarding',
  ADMIN_REGULATORS: '/admin/regulators',
  ADMIN_REGULATOR_DETAIL: '/admin/regulators/:id',
  ADMIN_TENANTS: '/admin/tenants',
  ADMIN_TENANT_DETAIL: '/admin/tenants/:id',
  ADMIN_PIPELINE: '/admin/pipeline',
  ADMIN_PIPELINE_DETAIL: '/admin/pipeline/:id',
  ADMIN_INSTRUMENT_TENANTS: '/admin/instruments/:id/tenants',
  ADMIN_LICENSES: '/admin/licenses',
  ADMIN_LICENSE_DETAIL: '/admin/licenses/:id',
};

export const STRINGS = {
  SEARCH_PLACEHOLDER: 'Search compliance data, instruments, frameworks...',
  REPORTING_PERIOD: 'Q1 2026 Reporting Period',
  PROFILE_SETTINGS: 'Profile Settings',
  ACCOUNT: 'Account',
  SIGN_OUT: 'Sign Out',
  REMEMBER_ME: 'Remember me',
  FORGOT_PASSWORD: 'Forgot password?',
  SIGN_IN: 'Sign In',
  DEMO_LOGIN: 'Demo Login (Compliance Director)',
  LOGIN_ERROR_EMPTY: 'Please enter both email and password',
  LOGIN_ERROR_FAILED: 'Login failed',
};

export const LABELS = {
  DASHBOARD: 'Dashboard',
  OBLIGATION_LIBRARY: 'Obligation Library',
  REVIEW_INBOX: 'Review Inbox',
  WATCHLIST: 'Watchlist',
  COMPLIANCE_SETTINGS: 'Compliance Settings',
  INTEGRATION_API: 'Integration API',
  REGULATORS: 'Regulators',
  TENANT_MANAGEMENT: 'Tenant Management',
  PIPELINE: 'Pipeline Jobs',
  LICENSES: 'License Management',
};

export const NAV_SECTIONS = [
  { label: 'MAIN', items: [
    { text: 'Dashboard', icon: 'Dashboard', path: ROUTES.DASHBOARD },
  ]},
  { label: 'INTELLIGENCE', items: [
    { text: 'Obligation Library', icon: 'LibraryBooks', path: ROUTES.LIBRARY },
    { text: 'Review Inbox', icon: 'Inbox', path: ROUTES.INBOX },
    { text: 'Watchlist', icon: 'Visibility', path: ROUTES.WATCHLIST },
  ]},
  { label: 'PLATFORM', items: [
    { text: 'Regulators', icon: 'AccountBalance', path: ROUTES.ADMIN_REGULATORS },
    { text: 'Tenant Management', icon: 'AdminPanelSettings', path: ROUTES.ADMIN_TENANTS },
    { text: 'License Management', icon: 'VpnKey', path: ROUTES.ADMIN_LICENSES },
    { text: 'Pipeline Jobs', icon: 'AccountTree', path: ROUTES.ADMIN_PIPELINE },
  ]},
];

export const RISK_CONFIG = {
  High: { label: 'High' },
  Medium: { label: 'Medium' },
  Low: { label: 'Low' },
};

export const STATUS_CONFIG = {
  unclassified: { label: 'Unclassified' },
  applicable: { label: 'Applicable' },
  not_applicable: { label: 'Not Applicable' },
  under_review: { label: 'Under Review' },
};

export const INBOX_LABELS = {
  TITLE: 'Review Inbox',
  SUBTITLE: 'Review and classify incoming regulatory intelligence relevant to your license',
  TAB_NEEDS_REVIEW: 'Needs Review',
  TAB_APPLICABLE: 'Applicable',
  TAB_ARCHIVED: 'Archived',
  CLASSIFICATION_HISTORY: 'Classification History',
  BULK_CONFIRM: 'Bulk Confirm',
  PENDING_REVIEW: 'Pending Review',
  HIGH_RISK_ALERT: 'High Risk Alert',
  AI_CONFIRMED: 'AI Confirmed',
  REVIEW_SPEED: 'Review Speed',
};

export const LIBRARY_LABELS = {
  TITLE: 'Obligation Library',
  SUBTITLE: 'Global repository of regulatory instruments and mandatory obligations',
  RECENT_UPDATES: 'Recent Updates',
  EXPORT_LIBRARY: 'Export Library',
  TOTAL_INSTRUMENTS: 'Total Instruments',
  HIGH_RISK: 'High Risk',
  ACTIVE_WATCHES: 'Active Watches',
  NEW_THIS_MONTH: 'New This Month',
  SEARCH_PLACEHOLDER: 'Search by title or keywords...',
};

export const WATCHLIST_LABELS = {
  TITLE: 'Watchlist',
  SUBTITLE: 'Monitor regulatory instruments relevant to your organization',
  ADD_TO_WATCHLIST: 'Add to Watchlist',
  ACTIVE_WATCHES: 'Active Watches',
  UPDATES_THIS_WEEK: 'Updates This Week',
  EXPIRING_SOON: 'Expiring Soon',
  COVERAGE_SCORE: 'Coverage Score',
  ALL_WATCHES: 'All Watches',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRING_SOON_LABEL: 'Expiring Soon',
};

export const DEMO = {
  USER: {
    id: 'u-001',
    email: 'adaeze.usman@atheris.ng',
    firstName: 'Adaeze',
    lastName: 'Usman',
    role: 'COMPLIANCE_DIRECTOR',
    tenantId: 't-001',
    orgIds: ['o-001'],
    permissions: [
      'carbon_data:create', 'carbon_data:read', 'carbon_data:update', 'carbon_data:approve',
      'data_points:create', 'data_points:read', 'data_points:update', 'data_points:approve',
      'compliance:read', 'compliance:configure',
      'reports:create', 'reports:read', 'reports:update', 'reports:approve', 'reports:export',
      'risk:read', 'risk:create', 'supply_chain:read', 'supply_chain:create',
      'social:read', 'social:create', 'governance:read', 'analytics:read',
      'investor:read', 'carbon_market:read', 'training:read', 'users:read', 'audit_logs:read',
    ],
    timezone: 'Africa/Lagos',
    preferredLanguage: 'en',
  },
};
