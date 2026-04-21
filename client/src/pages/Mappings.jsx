import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const TRANSFORMS = ['', 'trim', 'lowercase', 'uppercase', 'date_iso', 'phone_raw', 'country_iso2'];

const EMPTY = {
  hubspot_field: '',
  amp_field: '',
  transform: '',
  default_value: '',
  is_required: false,
  active: true,
  notes: ''
};

export default function Mappings() {
  const [mappings, setMappings] = useState([]);
  const [editing, setEditing] = useState({});
  const [draft, setDraft] = useState(EMPTY);
  const [testVal, setTestVal] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testTransform, setTestTransform] = useState('trim');

  async function load() {
    const { mappings } = await api.get('/api/mappings');
    setMappings(mappings);
  }

  useEffect(() => { load(); }, []);

  function startEdit(m) {
    setEditing({ ...editing, [m.id]: { ...m } });
  }

  function cancelEdit(id) {
    const next = { ...editing };
    delete next[id];
    setEditing(next);
  }

  async function saveEdit(id) {
    const m = editing[id];
    await api.patch(`/api/mappings/${id}`, {
      hubspot_field: m.hubspot_field,
      amp_field: m.amp_field,
      transform: m.transform || null,
      default_value: m.default_value || null,
      is_required: !!m.is_required,
      active: !!m.active,
      notes: m.notes || null
    });
    cancelEdit(id);
    await load();
  }

  async function del(id) {
    if (!confirm('Delete this mapping?')) return;
    await api.del(`/api/mappings/${id}`);
    await load();
  }

  async function create(e) {
    e.preventDefault();
    await api.post('/api/mappings', draft);
    setDraft(EMPTY);
    await load();
  }

  async function runTest() {
    const { result } = await api.post('/api/mappings/test-transform', { transform: testTransform, value: testVal });
    setTestResult(result);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Field mappings</h1>

      <div className="card p-3">
        <h2 className="text-sm font-semibold mb-2">Test transform</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-slate-500 block">Transform</label>
            <select className="input" value={testTransform} onChange={(e) => setTestTransform(e.target.value)}>
              {TRANSFORMS.filter(Boolean).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 block">Value</label>
            <input className="input" value={testVal} onChange={(e) => setTestVal(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={runTest}>Test</button>
          {testResult !== '' && <span className="text-sm font-mono">→ {JSON.stringify(testResult)}</span>}
        </div>
      </div>

      <form onSubmit={create} className="card p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input className="input" placeholder="hubspot_field (or __fixed__)" required
               value={draft.hubspot_field} onChange={(e) => setDraft({ ...draft, hubspot_field: e.target.value })} />
        <input className="input" placeholder="amp_field" required
               value={draft.amp_field} onChange={(e) => setDraft({ ...draft, amp_field: e.target.value })} />
        <select className="input" value={draft.transform}
                onChange={(e) => setDraft({ ...draft, transform: e.target.value })}>
          {TRANSFORMS.map((t) => <option key={t} value={t}>{t || '(none)'}</option>)}
        </select>
        <input className="input" placeholder="default_value"
               value={draft.default_value} onChange={(e) => setDraft({ ...draft, default_value: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.is_required}
                 onChange={(e) => setDraft({ ...draft, is_required: e.target.checked })} />
          Required
        </label>
        <button className="btn-primary">Add mapping</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">HubSpot field</th>
              <th className="th">amp field</th>
              <th className="th">Transform</th>
              <th className="th">Default</th>
              <th className="th">Required</th>
              <th className="th">Active</th>
              <th className="th">Notes</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => {
              const edit = editing[m.id];
              if (edit) {
                return (
                  <tr key={m.id}>
                    <td className="td"><input className="input" value={edit.hubspot_field}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, hubspot_field: e.target.value } })} /></td>
                    <td className="td"><input className="input" value={edit.amp_field}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, amp_field: e.target.value } })} /></td>
                    <td className="td">
                      <select className="input" value={edit.transform || ''}
                              onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, transform: e.target.value } })}>
                        {TRANSFORMS.map((t) => <option key={t} value={t}>{t || '(none)'}</option>)}
                      </select>
                    </td>
                    <td className="td"><input className="input" value={edit.default_value || ''}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, default_value: e.target.value } })} /></td>
                    <td className="td"><input type="checkbox" checked={!!edit.is_required}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, is_required: e.target.checked } })} /></td>
                    <td className="td"><input type="checkbox" checked={!!edit.active}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, active: e.target.checked } })} /></td>
                    <td className="td"><input className="input" value={edit.notes || ''}
                        onChange={(e) => setEditing({ ...editing, [m.id]: { ...edit, notes: e.target.value } })} /></td>
                    <td className="td flex gap-1">
                      <button className="btn-primary" onClick={() => saveEdit(m.id)}>Save</button>
                      <button className="btn" onClick={() => cancelEdit(m.id)}>Cancel</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="td font-mono">{m.hubspot_field}</td>
                  <td className="td font-mono">{m.amp_field}</td>
                  <td className="td">{m.transform}</td>
                  <td className="td">{m.default_value}</td>
                  <td className="td">{m.is_required ? 'Yes' : ''}</td>
                  <td className="td">{m.active ? 'Yes' : 'No'}</td>
                  <td className="td text-slate-500">{m.notes}</td>
                  <td className="td flex gap-1">
                    <button className="btn" onClick={() => startEdit(m)}>Edit</button>
                    <button className="btn-danger" onClick={() => del(m.id)}>Delete</button>
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
