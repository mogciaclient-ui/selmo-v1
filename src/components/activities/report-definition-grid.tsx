export function ReportDefinitionGrid({ rows }: { rows: Array<[string, string]> }) {
  const visibleRows = rows.filter(([, value]) => value !== "—");
  if (!visibleRows.length) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">登録内容はありません。</p>;
  }

  return (
    <dl className="grid overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map(([label, value], index) => (
        <div key={`${label}-${index}`} className="border-b border-r border-slate-100 p-4">
          <dt className="text-xs font-semibold text-slate-400">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
