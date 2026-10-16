import { useNavigate, useParams } from 'react-router-dom';
import ObligationDetailView from './ObligationDetailView';

export default function ObligationExplorerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <ObligationDetailView obligationId={Number(id)} onBack={() => navigate('/admin/obligations')} />
  );
}