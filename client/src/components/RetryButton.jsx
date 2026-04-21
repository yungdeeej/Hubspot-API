import { useState } from 'react';
import { api } from '../lib/api.js';

export default function RetryButton({ enrollmentId, onDone }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function onClick() {
    setLoading(true);
    setMsg('');
    try {
      await api.post(`/api/enrollments/${enrollmentId}/retry`);
      setMsg('Queued');
      onDone?.();
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={onClick} disabled={loading} className="btn-primary">
        {loading ? 'Retrying…' : 'Retry'}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
