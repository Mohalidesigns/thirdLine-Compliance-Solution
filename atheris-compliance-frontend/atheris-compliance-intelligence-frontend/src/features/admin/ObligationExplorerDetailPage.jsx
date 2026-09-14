import ObligationDetailView from '../../../../shared/components/ObligationDetailView.jsx';
import api, { getToken, API_BASE } from '../../services/api';

export default function ObligationExplorerDetailPage() {
  return <ObligationDetailView mode="intel" api={api} getToken={getToken} API_BASE={API_BASE} />;
}
