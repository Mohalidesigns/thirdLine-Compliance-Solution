import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, Tooltip, Typography, CircularProgress, Alert,
} from '@mui/material';
import { TL } from '../theme/tokens';
import { SearchInput } from './FilterBar';

/**
 * Shared register table used by every list/detail-section page.
 *
 * Columns (max 5): { id, label, minWidth?, maxWidth?, truncate?, sortable?, render?(row) }
 * - default cells render `row[id]` as a single-line truncated value with a hover tooltip
 *   when `truncate` is true.
 * - `render` wins for custom cells.
 *
 * Server-driven: the parent owns page/size/sort/search state and data fetching; this
 * component is purely presentational. `actions(row)` adds a trailing actions column
 * (tenant CRUD); omit it for read-only registers. `search.action` renders a node
 * (e.g. an "Upload" button) inline after the search box.
 */
function CellContent({ col, row }) {
  if (col.render) return col.render(row);
  const v = row[col.id];
  const text = v == null || v === '' ? '—' : String(v);
  if (col.truncate) {
    return (
      <Tooltip title={text} placement="top">
        <Typography variant="body2" sx={{
          color: 'inherit', maxWidth: col.maxWidth || 260, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {text}
        </Typography>
      </Tooltip>
    );
  }
  return <Typography variant="body2" sx={{ color: 'inherit' }}>{text}</Typography>;
}

export default function SectionTable({
  columns = [], rows = [], total = 0, page = 0, size = 20,
  loading = false, error = null,
  sortField, sortDir = 'asc', onSort, onPage, onSize,
  onRowClick, rowKey = (r) => r.id, actions,
  search, emptyMessage = 'No records found.', emptyIcon,
  rowsPerPageOptions = [10, 20, 50], children,
}) {
  const showActions = typeof actions === 'function';

  if (loading && rows.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{String(error.message || error)}</Alert>}

      {search && (
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder || 'Search…'}
            fullWidth={false}
            sx={{ minWidth: 300 }}
          />
          {search.action}
        </Box>
      )}

      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: TL.gray400 }}>
            {emptyIcon}
            <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>{emptyMessage}</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((c) => {
                      const sortKey = c.sortField || c.id;
                      const active = sortField === sortKey;
                      return (
                        <TableCell
                          key={c.id}
                          sx={{
                            minWidth: c.minWidth,
                            cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none',
                          }}
                          onClick={c.sortable && onSort ? () => onSort(sortKey) : undefined}
                        >
                          {c.sortable
                            ? (
                              <TableSortLabel
                                active={active}
                                direction={active ? sortDir : 'asc'}
                                sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}
                              >
                                {c.label}
                              </TableSortLabel>
                            )
                            : c.label}
                        </TableCell>
                      );
                    })}
                    {showActions && <TableCell key="__actions" align="right" sx={{ width: 90 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={rowKey(row)}
                      hover={!!onRowClick}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      sx={{ cursor: onRowClick ? 'pointer' : 'default', '& td': { verticalAlign: 'middle' } }}
                    >
                      {columns.map((c) => (
                        <TableCell key={c.id}><CellContent col={c} row={row} /></TableCell>
                      ))}
                      {showActions && (
                        <TableCell key="__actions" align="right" onClick={(e) => e.stopPropagation()}>
                          {actions(row)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={size}
              onPageChange={(_, p) => onPage && onPage(p)}
              onRowsPerPageChange={(e) => onSize && onSize(parseInt(e.target.value, 10))}
              rowsPerPageOptions={rowsPerPageOptions}
            />
          </>
        )}
      </Paper>
      {children}
    </>
  );
}
