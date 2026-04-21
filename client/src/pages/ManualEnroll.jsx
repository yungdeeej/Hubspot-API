import { useState } from 'react';
import { api } from '../lib/api.js';

export default function ManualEnroll() {
  const [email, setEmail] = useState('');
  const [contacts, setContacts] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [dealId, setDealId] = useState('');
  const [result, setResult] = useState('');

  async function search(e) {
    e.preventDefault();
    setErr(''); setResult(''); setContacts([]);
    setLoading(true);
    try {
      const { contacts } = await api.post('/api/manual-enroll/search', { email });
      setContacts(contacts);
      if (contacts.length === 0) setErr('No HubSpot contact found with that email.');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitSync(e) {
    e.preventDefault();
    setErr(''); setResult('');
    try {
      await api.post('/api/manual-enroll/sync', { hubspotDealId: dealId });
      setResult(`Sync queued for deal ${dealId}. Check dashboard for status.`);
      setDealId('');
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Manual enrollment</h1>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Find HubSpot contact by email</h2>
        <form onSubmit={search} className="flex flex-wrap gap-2">
          <input type="email" className="input flex-1 min-w-[240px]" required
                 placeholder="student@example.com"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        {contacts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">HubSpot ID</th>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">amp student</th>
                  <th className="th">sync status</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="td font-mono">{c.id}</td>
                    <td className="td">{c.properties.firstname} {c.properties.lastname}</td>
                    <td className="td">{c.properties.email}</td>
                    <td className="td font-mono">{c.properties.amp_student_id || ''}</td>
                    <td className="td">{c.properties.amp_sync_status || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Force-sync a specific deal</h2>
        <form onSubmit={submitSync} className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[240px]" required
                 placeholder="HubSpot deal ID"
                 value={dealId} onChange={(e) => setDealId(e.target.value)} />
          <button className="btn-primary">Queue sync</button>
        </form>
        {result && <div className="text-sm text-green-700">{result}</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
