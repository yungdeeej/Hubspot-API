import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const CREDENTIALS = ['Diploma', 'Certificate', 'Other'];

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [editing, setEditing] = useState({});

  async function load() {
    const { providers } = await api.get('/api/providers');
    setProviders(providers);
  }
  useEffect(() => { load(); }, []);

  async function save(id) {
    const e = editing[id];
    await api.patch(`/api/providers/${id}`, {
      program_label: e.program_label,
      amp_provider_id: e.amp_provider_id,
      amp_program_id: Number(e.amp_program_id),
      credential: e.credential,
      active: !!e.active,
      notes: e.notes || null
    });
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lead Providers</h1>
      <p className="text-sm text-slate-500">
        Each row maps a program code to its amp Lead Provider endpoint and program ID.
      </p>
      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Code</th>
              <th className="th">Label</th>
              <th className="th">amp provider_id</th>
              <th className="th">amp program_id</th>
              <th className="th">Credential</th>
              <th className="th">Active</th>
              <th className="th">Notes</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const e = editing[p.id];
              if (e) {
                return (
                  <tr key={p.id}>
                    <td className="td font-mono">{p.program_code}</td>
                    <td className="td"><input className="input" value={e.program_label}
                        onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, program_label: ev.target.value } })} /></td>
                    <td className="td"><input className="input font-mono" value={e.amp_provider_id}
                        onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, amp_provider_id: ev.target.value } })} /></td>
                    <td className="td"><input type="number" className="input" value={e.amp_program_id}
                        onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, amp_program_id: ev.target.value } })} /></td>
                    <td className="td">
                      <select className="input" value={e.credential}
                              onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, credential: ev.target.value } })}>
                        {CREDENTIALS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="td"><input type="checkbox" checked={!!e.active}
                        onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, active: ev.target.checked } })} /></td>
                    <td className="td"><input className="input" value={e.notes || ''}
                        onChange={(ev) => setEditing({ ...editing, [p.id]: { ...e, notes: ev.target.value } })} /></td>
                    <td className="td flex gap-1">
                      <button className="btn-primary" onClick={() => save(p.id)}>Save</button>
                      <button className="btn" onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}>Cancel</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td font-mono font-semibold">{p.program_code}</td>
                  <td className="td">{p.program_label}</td>
                  <td className="td font-mono">{p.amp_provider_id}</td>
                  <td className="td">{p.amp_program_id}</td>
                  <td className="td">{p.credential}</td>
                  <td className="td">{p.active ? 'Yes' : 'No'}</td>
                  <td className="td text-slate-500">{p.notes}</td>
                  <td className="td">
                    <button className="btn" onClick={() => setEditing({ ...editing, [p.id]: { ...p } })}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
