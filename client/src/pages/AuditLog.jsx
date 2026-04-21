import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ enrollment_id: '', actor: '', action: '', since: '' });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const { audit } = await api.get(`/api/audit-log?${params.toString()}`);
      setRows(audit);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function exportCsv() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    window.location.href = `/api/audit-log/export.csv?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>

      <div className="card p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input className="input" placeholder="Enrollment ID"
               value={filters.enrollment_id}
               onChange={(e) => setFilters({ ...filters, enrollment_id: e.target.value })} />
        <input className="input" placeholder="Actor (email or 'system')"
               value={filters.actor}
               onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
        <input className="input" placeholder="Action (e.g. sync.success)"
               value={filters.action}
               onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
        <input type="datetime-local" className="input"
               value={filters.since}
               onChange={(e) => setFilters({ ...filters, since: e.target.value })} />
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={load}>Apply</button>
          <button className="btn" onClick={exportCsv}>CSV</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">When</th>
              <th className="th">Action</th>
              <th className="th">Actor</th>
              <th className="th">Enrollment</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="td text-slate-500" colSpan={5}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>No entries.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="td font-mono">{r.action}</td>
                <td className="td">{r.actor}</td>
                <td className="td font-mono text-xs">{r.enrollment_id}</td>
                <td className="td">
                  {r.details && (
                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-1 max-w-md overflow-auto">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
