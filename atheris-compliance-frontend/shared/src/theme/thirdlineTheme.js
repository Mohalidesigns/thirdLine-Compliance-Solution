import { createTheme } from '@mui/material/styles';
import { TL, tone } from './tokens';

/**
 * Shared MUI theme for BOTH Atheris frontends, modelled on the Thirdline Internal Audit UI:
 * Figtree type, white 12px cards with a hairline gray-100 border and shadow-sm, uppercase
 * gray-500 table heads, pill badges, 8px inputs/buttons. Component overrides here restyle
 * every page at once — page-level `sx` should only add layout, not re-theme.
 */

// Soft (Thirdline badge) colours for filled chips, keyed by MUI palette colour.
const CHIP_COLOR_TONE = {
  default: 'gray', primary: 'blue', secondary: 'green', error: 'red',
  warning: 'orange', info: 'teal', success: 'green',
};

const thirdlineTheme = createTheme({
  palette: {
    primary: { main: TL.primary, light: TL.primaryLight, dark: TL.primaryDark, contrastText: '#FFFFFF' },
    secondary: { main: TL.secondary, light: '#38A169', dark: '#1E5C32', contrastText: '#FFFFFF' },
    warning: { main: TL.warning, light: '#ED8936', dark: '#C05621', contrastText: '#FFFFFF' },
    error: { main: TL.error, light: '#E53E3E', dark: '#9B2C2C', contrastText: '#FFFFFF' },
    info: { main: TL.info, light: '#38B2AC', dark: '#285E61', contrastText: '#FFFFFF' },
    success: { main: TL.success, light: '#38A169', dark: '#22543D', contrastText: '#FFFFFF' },
    accent: { main: TL.accent, light: TL.accentLight, dark: '#B8961E', contrastText: TL.primary },
    orange: { main: TL.warning },
    background: { default: TL.bg, paper: TL.card },
    text: { primary: TL.textPrimary, secondary: TL.gray500 },
    divider: TL.gray200,
    action: { hover: TL.gray50, selected: 'rgba(26, 54, 93, 0.06)' },
  },
  typography: {
    fontFamily: TL.font,
    h1: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.25, color: TL.textPrimary },
    h2: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.33, color: TL.textPrimary },
    h3: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.33, color: TL.textPrimary },
    // Page titles across both apps are h4/h5 — Thirdline renders them at 24px / 700.
    h4: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.33, color: TL.textPrimary },
    h5: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.4, color: TL.textPrimary },
    // Card/section titles: 14px / 600 gray-800.
    h6: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.43, color: TL.gray800 },
    subtitle1: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.45, color: TL.gray800 },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.45, color: TL.gray700 },
    body1: { fontSize: '0.875rem', lineHeight: 1.43 },
    body2: { fontSize: '0.875rem', lineHeight: 1.43 },
    caption: { fontSize: '0.75rem', lineHeight: 1.33, color: TL.gray500 },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 1.5, color: TL.gray400 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
    mono: { fontFamily: TL.mono },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: TL.bg, color: TL.textPrimary } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        rounded: { borderRadius: 12 },
        elevation0: { border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow },
        elevation1: { border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow },
        outlined: { border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${TL.gray100}`, boxShadow: TL.cardShadow },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '16px 24px', borderBottom: `1px solid ${TL.gray100}` },
        title: { fontSize: '0.875rem', fontWeight: 600, color: TL.gray800 },
        subheader: { fontSize: '0.75rem', color: TL.gray500 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.43,
          borderRadius: 8, padding: '8px 16px', boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        sizeSmall: { padding: '5px 12px', fontSize: '0.8125rem' },
        sizeLarge: { padding: '10px 20px', fontSize: '0.9375rem' },
        containedPrimary: { backgroundColor: TL.primary, '&:hover': { backgroundColor: TL.primaryDark } },
        containedError: { backgroundColor: TL.error, '&:hover': { backgroundColor: '#9B2C2C' } },
        outlined: {
          backgroundColor: '#FFFFFF', borderColor: TL.gray300,
          '&:hover': { backgroundColor: TL.gray50, borderColor: TL.gray300 },
        },
        outlinedPrimary: { color: TL.primary },
        text: { '&:hover': { backgroundColor: TL.gray50 } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8, color: TL.gray400, '&:hover': { color: TL.primary, backgroundColor: TL.gray50 } },
      },
    },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 0 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem', lineHeight: 1.43, color: TL.gray700,
          padding: '12px 16px', borderBottom: `1px solid ${TL.gray100}`,
        },
        head: {
          backgroundColor: TL.gray50, color: TL.gray500, fontSize: '0.75rem', fontWeight: 600,
          lineHeight: 1.33, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
        },
        stickyHeader: { backgroundColor: TL.gray50 },
        sizeSmall: { padding: '10px 16px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': { backgroundColor: TL.gray50 },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: { color: 'inherit', '&:hover': { color: TL.gray700 }, '&.Mui-active': { color: TL.gray700 } },
        icon: { fontSize: 16 },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { borderTop: `1px solid ${TL.gray100}`, color: TL.gray500 },
        selectLabel: { fontSize: '0.8125rem' },
        displayedRows: { fontSize: '0.8125rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const t = tone(CHIP_COLOR_TONE[ownerState.color] || 'gray');
          const base = {
            borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600,
            height: ownerState.size === 'small' ? 22 : 26,
          };
          if (ownerState.variant === 'outlined') {
            return {
              ...base, backgroundColor: '#FFFFFF',
              borderColor: ownerState.color === 'default' ? TL.gray200 : t.dot,
              color: ownerState.color === 'default' ? TL.gray700 : t.fg,
            };
          }
          return {
            ...base, backgroundColor: t.bg, color: t.fg,
            '&.MuiChip-clickable:hover': { backgroundColor: t.bg, filter: 'brightness(0.97)' },
          };
        },
        label: { paddingLeft: 10, paddingRight: 10 },
        labelSmall: { paddingLeft: 8, paddingRight: 8 },
        icon: { color: 'inherit', fontSize: 14, marginLeft: 8 },
        deleteIcon: { color: 'inherit', opacity: 0.6, '&:hover': { color: 'inherit', opacity: 1 } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8, backgroundColor: '#FFFFFF', fontSize: '0.875rem',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: TL.gray200 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: TL.gray300 },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: TL.primary, borderWidth: 1 },
          '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(26, 54, 93, 0.12)' },
          '&.Mui-disabled': { backgroundColor: TL.gray50 },
        },
        input: { padding: '10px 12px' },
        inputSizeSmall: { padding: '8.5px 12px' },
      },
    },
    MuiInputBase: {
      styleOverrides: { root: { fontSize: '0.875rem' } },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem', color: TL.gray500, '&.Mui-focused': { color: TL.primary } },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { fontSize: '0.75rem', marginLeft: 2 } },
    },
    MuiSelect: {
      styleOverrides: { icon: { color: TL.gray400 } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 8, border: `1px solid ${TL.gray200}`, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' },
      },
    },
    MuiPopover: {
      styleOverrides: { paper: { borderRadius: 8 } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem', color: TL.gray700,
          '&:hover': { backgroundColor: TL.gray50 },
          '&.Mui-selected': { backgroundColor: 'rgba(26, 54, 93, 0.06)', color: TL.primary, fontWeight: 600 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { backgroundColor: TL.primary, height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', minHeight: 44,
          color: TL.gray500, '&.Mui-selected': { color: TL.primary },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: '0.875rem', alignItems: 'center' },
        standardError: { backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
        standardWarning: { backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' },
        standardSuccess: { backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
        standardInfo: { backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: TL.gray800, fontSize: '0.75rem', fontWeight: 500, borderRadius: 6, padding: '6px 10px' },
        arrow: { color: TL.gray800 },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 12, border: 'none' } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1.125rem', fontWeight: 600, color: TL.gray800, padding: '20px 24px', borderBottom: `1px solid ${TL.gray100}` },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        // MUI zeroes the top padding after a DialogTitle; the title already carries a rule, so keep the gap.
        root: { padding: '20px 24px', '.MuiDialogTitle-root + &': { paddingTop: 20 } },
        // `dividers` would double the title/actions rules the theme already draws.
        dividers: { borderTop: 'none', borderBottom: 'none', padding: '20px 24px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '16px 24px', borderTop: `1px solid ${TL.gray100}`, gap: 8 } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { border: 'none' } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: TL.gray100 } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 8, borderRadius: 9999, backgroundColor: TL.gray200 },
        bar: { borderRadius: 9999 },
      },
    },
    MuiAvatar: {
      styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 600 } },
    },
    MuiBadge: {
      styleOverrides: { badge: { fontSize: '0.625rem', fontWeight: 700, minWidth: 18, height: 18 } },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${TL.gray100}`, borderRadius: 12, boxShadow: TL.cardShadow,
          '&:before': { display: 'none' }, '&:not(:last-of-type)': { marginBottom: 12 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', borderColor: TL.gray200 } },
    },
    MuiListItemText: {
      styleOverrides: { primary: { fontSize: '0.875rem' } },
    },
  },
});

export default thirdlineTheme;
