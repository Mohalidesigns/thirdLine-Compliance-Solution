import { useNavigate, useParams } from 'react-router-dom';
import ObligationDetailView from './ObligationDetailView';

/**
 * Route shell for `/admin/obligations/:id`.
 *
 * The layout lives in the shared-kit `ObligationDetailView` — the same
 * header → verbatim/plain → coverage strip → tabs → section table recipe the tenant
 * obligation detail uses — so both apps render one obligation detail the same way.
 */
export default function ObligationExplorerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <ObligationDetailView
      obligationId={Number(id)}
      onBack={() => navigate('/admin/obligations')}
    />
  );
}
