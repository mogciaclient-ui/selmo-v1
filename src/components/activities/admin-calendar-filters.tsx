"use client";

import { useState } from "react";

type Scope = "department" | "team" | "custom";
type Member = { id: string; name: string };

export function AdminCalendarScope({ initialScope, members, selectedEmployeeId, selectedEmployeeIds }: { initialScope: Scope; members: Member[]; selectedEmployeeId: string; selectedEmployeeIds: string[] }) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [selected, setSelected] = useState(selectedEmployeeIds);

  return <>
    <fieldset className="flex items-center gap-3 text-sm font-semibold">
      <legend className="sr-only">表示対象</legend>
      <ScopeRadio value="department" label="部署" scope={scope} onChange={setScope}/>
      <ScopeRadio value="team" label="チーム" scope={scope} onChange={setScope}/>
      <ScopeRadio value="custom" label="任意選択" scope={scope} onChange={setScope}/>
    </fieldset>
    {scope === "custom" && <fieldset className="w-full rounded-xl border border-amber-200 bg-white p-3 lg:w-auto lg:min-w-[360px]">
      <legend className="px-1 text-xs font-bold text-slate-600">表示するメンバー（複数選択可）</legend>
      <div className="mt-1 grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-amber-50">
          <input type="checkbox" name="employeeIds" value={member.id} checked={selected.includes(member.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} className="size-4 accent-[#e5ad00]"/>
          <span>{member.name}</span>
        </label>)}
      </div>
      {!members.length && <p className="px-2 py-2 text-xs text-slate-400">選択できるメンバーがいません。</p>}
    </fieldset>}
    {scope !== "custom" && <select name="employeeId" defaultValue={selectedEmployeeId} aria-label="担当者" className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">全メンバー</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}
  </>;
}

function ScopeRadio({ value, label, scope, onChange }: { value: Scope; label: string; scope: Scope; onChange: (scope: Scope) => void }) {
  return <label className="flex items-center gap-1.5"><input type="radio" name="scope" value={value} checked={scope === value} onChange={() => onChange(value)} className="accent-[#e5ad00]"/>{label}</label>;
}
