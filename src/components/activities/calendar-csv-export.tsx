"use client";

import { useState } from "react";
import { Download } from "lucide-react";
export function CalendarCsvExport({ defaultStart, defaultEnd, departmentId, employeeId }: { defaultStart: string; defaultEnd: string; departmentId?: string; employeeId?: string }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [message, setMessage] = useState("");

  async function download() {
    const startDate = new Date(`${start}T00:00:00+09:00`);
    const endDate = new Date(`${end}T23:59:59+09:00`);
    if (!start || !end || endDate < startDate) return setMessage("正しい日付範囲を指定してください。");
    const limit = new Date(startDate); limit.setMonth(limit.getMonth() + 3); limit.setDate(limit.getDate() + 1);
    if (endDate >= limit) return setMessage("日付範囲は最大3か月までです。");
    setMessage("CSVを作成しています…");
    const params = new URLSearchParams({ start, end }); if (departmentId) params.set("departmentId", departmentId); if (employeeId) params.set("employeeId", employeeId);
    const response = await fetch(`/api/schedule/export?${params}`);
    if (!response.ok) { const body = await response.json().catch(() => ({})) as { message?: string }; return setMessage(body.message ?? "CSVを出力できませんでした。"); }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `schedule_${start}_${end}.csv`; link.click(); URL.revokeObjectURL(url);
    setMessage("CSVをダウンロードしました。");
  }

  return <div className="border-t border-slate-200 bg-slate-50/70 p-5 md:p-6"><p className="text-sm font-semibold text-slate-700">上記に表示されているメンバーのスケジュールデータを下記条件でCSV出力します。</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-slate-500">日付範囲<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-500" /></label><span className="pb-2 text-slate-400">～</span><label className="text-xs font-semibold text-slate-500"><span className="sr-only">終了日</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-500" /></label><span className="pb-2 text-xs text-slate-400">※最大3か月分</span><button type="button" onClick={download} className="flex h-10 items-center gap-2 rounded-lg bg-[#f2c94c] px-4 text-sm font-bold text-slate-900 hover:bg-[#ddb62f]"><Download size={17} />CSVダウンロード</button></div>{message && <p className="mt-3 text-xs font-semibold text-amber-800">{message}</p>}</div>;
}
