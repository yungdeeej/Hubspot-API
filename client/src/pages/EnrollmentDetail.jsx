import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import PayloadViewer from '../components/PayloadViewer.jsx';
import RetryButton from '../components/RetryButton.jsx';

const TABS = ['overview', 'payload', 'response', 'amp_log', 'audit'];

export default function EnrollmentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [payloadEdit, setPayloadEdit] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const d = await api.get(`/api/enrollments/${id}`);
    setData(d);
    setPayloadEdit(JSON.stringify(d.enrollment?.payload_sent || {}, null, 2));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function savePayload() {
    setErr('');
    try {
      const parsed = JSON.parse(payloadEdit);
      await api.patch(`/api/enrollments/${id}`, { payload_sent: parsed });
      setEditing(false);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function skip() {
    const reason = prompt('Reason for skipping?');
    if (reason === null) return;
    await api.post(`/api/enrollments/${id}/skip`, { reason });
    await load();
  }

  if (!data) return <div className="text-slate-500">Loading…</div>;
  const e = data.enrollment;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-slate-500 hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-semibold mt-1">{e.student_name || e.student_email}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={e.status} />
            <span>{e.program_name}</span>
            <span>·</span>
            <span className="font-mono">Deal {e.hubspot_deal_id}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <RetryButton enrollmentId={e.id} onDone={load} />
          <button className="btn" onClick={() => setEditing(true)}>Edit payload</button>
          <button className="btn-danger" onClick={skip}>Skip</button>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-2">
          {TABS.map((t) => (
            <button key={t}
              className={`px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-brand-accent text-brand-accent' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => setTab(t)}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === 'overview' && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div><dt className="text-slate-500">HubSpot deal</dt><dd className="font-mono">{e.hubspot_deal_id}</dd></div>
              <div><dt className="text-slate-500">HubSpot contact</dt><dd className="font-mono">{e.hubspot_contact_id}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd>{e.student_email}</dd></div>
              <div><dt className="text-slate-500">Program code</dt><dd>{e.resolved_program_code}</dd></div>
              <div><dt className="text-slate-500">amp provider</dt><dd>{e.amp_provider_id}</dd></div>
              <div><dt className="text-slate-500">amp program ID</dt><dd>{e.resolved_program_id}</dd></div>
              <div><dt className="text-slate-500">Student ID</dt><dd className="font-mono">{e.amp_student_id}</dd></div>
              <div><dt className="text-slate-500">Student key</dt><dd className="font-mono break-all">{e.amp_student_key}</dd></div>
              <div><dt className="text-slate-500">Retry count</dt><dd>{e.retry_count}</dd></div>
              <div><dt className="text-slate-500">Triggered by</dt><dd>{e.triggered_by}</dd></div>
              <div><dt className="text-slate-500">Created</dt><dd>{new Date(e.created_at).toLocaleString()}</dd></div>
              <div><dt className="text-slate-500">Completed</dt><dd>{e.completed_at ? new Date(e.completed_at).toLocaleString() : '—'}</dd></div>
              {e.error_message && (
                <div className="col-span-2">
                  <dt className="text-slate-500">Error</dt>
                  <dd className="text-red-700">{e.error_message}</dd>
                </div>
              )}
            </dl>
          )}
          {tab === 'payload' && (
            editing ? (
              <div className="space-y-2">
                <textarea className="input font-mono text-xs min-h-[40vh]" value={payloadEdit}
                          onChange={(ev) => setPayloadEdit(ev.target.value)} />
                {err && <div className="text-sm text-red-600">{err}</div>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={savePayload}>Save</button>
                  <button className="btn" onClick={() => { setEditing(false); setErr(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <PayloadViewer data={e.payload_sent} emptyText="No payload sent yet." />
            )
          )}
          {tab === 'response' && <PayloadViewer data={e.response_received} emptyText="No response yet." />}
          {tab === 'amp_log' && <PayloadViewer data={e.amp_log} emptyText="No amp log." />}
          {tab === 'audit' && (
            <div className="space-y-2">
              {data.audit.length === 0 && <div className="text-sm text-slate-500">No audit entries.</div>}
              {data.audit.map((a) => (
                <div key={a.id} className="border border-slate-200 rounded-md p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-mono">{a.action}</span>
                    <span className="text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-500 text-xs">{a.actor || 'system'}</div>
                  {a.details && (
                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded mt-1 p-2 overflow-auto">
                      {JSON.stringify(a.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
