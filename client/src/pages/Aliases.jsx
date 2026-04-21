import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Aliases() {
  const [aliases, setAliases] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hubspotValue, setHubspotValue] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const [a, p] = await Promise.all([api.get('/api/aliases'), api.get('/api/providers')]);
    setAliases(a.aliases || []);
    setProviders(p.providers || []);
    if (!programCode && p.providers?.[0]) setProgramCode(p.providers[0].program_code);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function add(e) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/api/aliases', { hubspot_value: hubspotValue, program_code: programCode });
      setHubspotValue('');
      await load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function del(id) {
    if (!confirm('Delete alias?')) return;
    await api.del(`/api/aliases/${id}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Program aliases</h1>
      <p className="text-sm text-slate-500">
        Map raw HubSpot values (case-insensitive) to canonical program codes.
      </p>

      <form onSubmit={add} className="card p-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-slate-500 block">HubSpot value</label>
          <input className="input" required value={hubspotValue} onChange={(e) => setHubspotValue(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block">Program code</label>
          <select className="input" value={programCode} onChange={(e) => setProgramCode(e.target.value)} required>
            {providers.map((p) => <option key={p.program_code} value={p.program_code}>{p.program_code} — {p.program_label}</option>)}
          </select>
        </div>
        <button className="btn-primary">Add alias</button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">HubSpot value</th>
              <th className="th">Program code</th>
              <th className="th">Active</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="td">{a.hubspot_value}</td>
                <td className="td font-mono font-semibold">{a.program_code}</td>
                <td className="td">{a.active ? 'Yes' : 'No'}</td>
                <td className="td"><button className="btn-danger" onClick={() => del(a.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
