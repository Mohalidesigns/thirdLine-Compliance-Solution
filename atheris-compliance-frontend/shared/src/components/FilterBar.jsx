import { Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField } from '@mui/material';
import { Close, Search } from '@mui/icons-material';

/**
 * Register filter bar (shared by every register/explorer page in BOTH apps).
 *
 * Props:
 *  - `search`   { value, onChange, placeholder?, minWidth? } — optional search box.
 *  - `filters`  [{ key, label, value, onChange, options:[{value,label}], allLabel?, minWidth? }]
 *               select filters; `value === 'All'` renders the "all" option.
 *  - `children` extra controls rendered after the selects (e.g. min/max amount fields).
 *  - `showClear`/`onClear` render the Clear button.
 */
export default function FilterBar({
  search, filters = [], onClear, showClear = false, children, sx,
}) {
  return (
    <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', ...sx }}>
      {search && (
        <TextField
          size="small"
          placeholder={search.placeholder || 'Search…'}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
          sx={{ minWidth: search.minWidth || 260 }}
        />
      )}
      {filters.map((f) => (
        <FormControl key={f.key} size="small" sx={{ minWidth: f.minWidth || 170 }}>
          <InputLabel>{f.label}</InputLabel>
          <Select label={f.label} value={f.value} onChange={(e) => f.onChange(e.target.value)}>
            <MenuItem value="All">{f.allLabel || 'All'}</MenuItem>
            {(f.options || []).map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ))}
      {children}
      {showClear && (
        <Button size="small" startIcon={<Close />} onClick={onClear}>Clear</Button>
      )}
    </Paper>
  );
}
