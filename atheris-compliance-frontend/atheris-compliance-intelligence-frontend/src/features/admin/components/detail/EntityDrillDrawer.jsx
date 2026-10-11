import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, Alert } from '@mui/material';
import { EntityDrawer } from 'shared';
import api from '../../../../services/api';
import SanctionDetailContent from './SanctionDetailContent';
import ControlDetailContent from './ControlDetailContent';
import ReturnDetailContent from './ReturnDetailContent';
import InstrumentDetailContent from './InstrumentDetailContent';

const ROUTE = {
  instrument: '/admin/instruments',
  sanction: '/admin/sanctions',
  return: '/admin/returns',
  control: '/admin/controls',
};
const LABEL = { instrument: 'Instrument', sanction: 'Sanction', return: 'Return', control: 'Control' };

/**
 * A right drawer that loads one small entity by id and renders its full detail. Used by
 * the Act-detail tabs and by the Obligation detail tabs so a row can be inspected in place.
 * Obligations are NOT handled here (they render the tabbed `ObligationDetailView` in a
 * drawer directly, kept out of this file to avoid an import cycle).
 */
export default function EntityDrillDrawer({ kind, id, onClose, onOpenFullPage, width = 680 }) {
  const navigate = useNavigate();
  const enabled = !!kind && !!id;

  const sanctionQ = useQuery({
    queryKey: ['sanction', String(id)],
    queryFn: ({ signal }) => api.platform.sanctions.get(id, signal),
    enabled: enabled && kind === 'sanction', staleTime: 60_000,
  });
  const controlQ = useQuery({
    queryKey: ['control', String(id)],
    queryFn: ({ signal }) => api.platform.controls.get(id, signal),
    enabled: enabled && kind === 'control', staleTime: 60_000,
  });
  const returnQ = useQuery({
    queryKey: ['return', String(id)],
    queryFn: ({ signal }) => api.platform.returns.get(id, signal),
    enabled: enabled && kind === 'return', staleTime: 60_000,
  });
  const instrumentQ = useQuery({
    queryKey: ['instrument', String(id)],
    queryFn: ({ signal }) => api.platform.instruments.get(id, signal),
    enabled: enabled && kind === 'instrument', staleTime: 60_000,
  });

  const active = kind === 'sanction' ? sanctionQ
    : kind === 'control' ? controlQ
    : kind === 'return' ? returnQ
    : kind === 'instrument' ? instrumentQ : null;

  // Instruments have no standalone detail route (InstrumentsPage opens its detail inline),
  // so no "Open full page" escape for them.
  const openFull = kind === 'instrument'
    ? undefined
    : (onOpenFullPage || (ROUTE[kind] ? () => navigate(`${ROUTE[kind]}/${id}`) : undefined));

  return (
    <EntityDrawer
      open={enabled}
      onClose={onClose}
      title={kind ? LABEL[kind] : ''}
      width={width}
      onOpenFull={openFull}
    >
      {active?.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          {active?.isError && <Alert severity="error">Failed to load {LABEL[kind]}.</Alert>}
          {kind === 'sanction' && sanctionQ.data && <SanctionDetailContent sanction={sanctionQ.data} />}
          {kind === 'control' && controlQ.data && (
            <ControlDetailContent control={controlQ.data} onActClick={(actId) => navigate(`/admin/acts/${actId}`)} />
          )}
          {kind === 'return' && returnQ.data && <ReturnDetailContent ret={returnQ.data} />}
          {kind === 'instrument' && instrumentQ.data && <InstrumentDetailContent detail={instrumentQ.data} />}
        </>
      )}
    </EntityDrawer>
  );
}