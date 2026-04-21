const COLORS = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  manual_review: 'bg-amber-100 text-amber-700',
  skipped: 'bg-slate-100 text-slate-500',
  duplicate: 'bg-purple-100 text-purple-700'
};

export default function StatusBadge({ status }) {
  const cls = COLORS[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {status}
    </span>
  );
}
