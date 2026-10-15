import { Box, Button, InputAdornment, MenuItem, Select, TextField, Typography } from '@mui/material';
import { TL } from '../theme/tokens';
import { MagnifyingGlassIcon, XMarkIcon } from '../icons/heroicons';

/**
 * Thirdline filter field: a 10px uppercase gray-400 label ABOVE the control (no floating
 * MUI label). Wrap any control (TextField, Select, date input…) to line it up with the
 * rest of a FilterBar.
 */
export function FilterField({ label, children, minWidth = 170, grow = false, sx }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth, flex: grow ? '1 1 260px' : '0 1 auto', ...sx }}>
      {label && (
        <Typography component="label" sx={{ fontSize: '0.625rem', fontWeight: 600, color: TL.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '0.9375rem' }}>
          {label}
        </Typography>
      )}
      {children}
    </Box>
  );
}

/** Search input in Thirdline style (magnifying glass, 40px tall). */
export function SearchInput({ value, onChange, placeholder = 'Search…', sx, ...rest }) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <MagnifyingGlassIcon size={18} sx={{ color: TL.gray400 }} />
            </InputAdornment>
          ),
        },
      }}
      sx={{ '& .MuiOutlinedInput-root': { height: 40 }, ...sx }}
      {...rest}
    />
  );
}

/**
 * Register filter card (shared by every register/explorer page in BOTH apps), rendered as
 * Thirdline's white filter card: labelled search + dropdowns on one wrapping row.
 *
 * Props:
 *  - `search`   { value, onChange, placeholder?, label?, minWidth? } — optional search box.
 *  - `filters`  [{ key, label, value, onChange, options:[{value,label}], allLabel?, minWidth? }]
 *               select filters; `value === 'All'` renders the "all" option.
 *  - `children` extra controls rendered after the selects — wrap them in `FilterField`.
 *  - `showClear`/`onClear` render the Clear button.
 */
export default function FilterBar({
  search, filters = [], onClear, showClear = false, children, sx,
}) {
  return (
    <Box sx={{
      bgcolor: '#FFFFFF', border: `1px solid ${TL.gray100}`, borderRadius: '12px', boxShadow: TL.cardShadow,
      p: 3, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', ...sx,
    }}>
      {search && (
        <FilterField label={search.label || 'Search'} minWidth={search.minWidth || 260} grow>
          <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} />
        </FilterField>
      )}
      {filters.map((f) => (
        <FilterField key={f.key} label={f.label} minWidth={f.minWidth || 180}>
          <Select
            size="small"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            sx={{ height: 40 }}
          >
            <MenuItem value="All">{f.allLabel || `All ${f.label}`}</MenuItem>
            {(f.options || []).map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FilterField>
      ))}
      {children}
      {showClear && (
        <Button
          variant="outlined"
          startIcon={<XMarkIcon size={16} />}
          onClick={onClear}
          sx={{ height: 40 }}
        >
          Clear
        </Button>
      )}
    </Box>
  );
}
