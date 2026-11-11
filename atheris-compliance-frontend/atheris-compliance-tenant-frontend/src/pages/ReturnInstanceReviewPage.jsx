import { Navigate, useParams } from 'react-router-dom';

export default function ReturnInstanceReviewPage() {
  const { returnId, instanceId } = useParams();
  return <Navigate to={`/returns/${returnId}?instanceId=${instanceId}&review=data`} replace />;
}