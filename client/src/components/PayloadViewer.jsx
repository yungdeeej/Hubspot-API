export default function PayloadViewer({ data, emptyText = 'No data' }) {
  if (!data) return <div className="text-sm text-slate-500 italic">{emptyText}</div>;
  return (
    <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-4 overflow-auto max-h-[60vh]">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}
