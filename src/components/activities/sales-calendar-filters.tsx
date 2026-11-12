"use client";

export function SalesCalendarScope({ members, selectedEmployeeId }: { members: { id: string; name: string }[]; selectedEmployeeId: string }) {
  return <label className="flex items-center gap-2 text-sm font-bold">表示するメンバー
    <select name="employeeId" defaultValue={selectedEmployeeId} onChange={event => event.currentTarget.form?.requestSubmit()} className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
      <option value="all">すべて</option>
      {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
    </select>
  </label>;
}
