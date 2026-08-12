import ReturnPicker from './ReturnPicker';
import { api } from '../../services/api';

export default function MapReturnModal({ open, onClose, obligationId, initialIds = [], onSaved, onError }) {
  async function handleSave(selected) {
    if (!obligationId) { onError?.('Missing obligation.'); return; }
    try {
      await api.obligations.linkReturns(obligationId, selected);
      onSaved?.();
    } catch (e) { onError?.(e.message || 'Failed to map returns.'); }
  }

  return (
    <ReturnPicker open={open} onClose={onClose} initialIds={initialIds}
      onSave={handleSave} />
  );
}