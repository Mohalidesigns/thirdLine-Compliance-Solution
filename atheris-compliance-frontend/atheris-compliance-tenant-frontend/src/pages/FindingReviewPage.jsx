import { Navigate, useParams } from 'react-router-dom';

export default function FindingReviewPage() {
  const { id } = useParams();
  return <Navigate to={`/findings?findingId=${id}`} replace />;
}