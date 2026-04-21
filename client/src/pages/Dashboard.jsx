import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';

function Card({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    green: 'text-green-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700'
  };
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tones[tone]}`}>{value ?? '—'}</div>
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [m, e] = await Promise.all([
        api.get('/api/metrics'),
        api.get(`/api/enrollments?limit=50${filterStatus ? `&status=${filterStatus}` : ''}${filterEmail ? `&email=${encodeURIComponent(filterEmail)}` : ''}`)
      ]);
      setMetrics(m);
      setEnrollments(e.enrollments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Today" value={metrics?.today} />
        <Card label="Pending" value={metrics?.pending} tone="blue" />
        <Card label="Success (24h)" value={metrics?.success_24h} tone="green" />
        <Card label="Failed" value={metrics?.failed} tone="red" />
        <Card label="Manual Review" value={metrics?.manual_review} tone="amber" />
      </div>

      <div className="card">
        <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center">
          <select className="input max-w-[180px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="in_progress">in_progress</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="manual_review">manual_review</option>
            <option value="duplicate">duplicate</option>
            <option value="skipped">skipped</option>
          </select>
          <input className="input max-w-[280px]" placeholder="Email contains…"
                 value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button className="btn" onClick={load}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Created</th>
                <th className="th">Email</th>
                <th className="th">Name</th>
                <th className="th">Program</th>
                <th className="th">Status</th>
                <th className="th">Student ID</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="td text-slate-500" colSpan={7}>Loading…</td></tr>
              )}
              {!loading && enrollments.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={7}>No enrollments.</td></tr>
              )}
              {enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="td">{e.student_email}</td>
                  <td className="td">{e.student_name}</td>
                  <td className="td">{e.program_name || e.resolved_program_code}</td>
                  <td className="td"><StatusBadge status={e.status} /></td>
                  <td className="td font-mono">{e.amp_student_id || ''}</td>
                  <td className="td text-right">
                    <Link className="text-brand-accent hover:underline" to={`/enrollments/${e.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
