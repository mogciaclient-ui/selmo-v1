export function salesCalendarSelection(selfId: string, members: { id: string }[], query: { employeeId?: string; scope?: string }) {
  // An explicit member takes priority over legacy scope links.
  if (query.employeeId === "all") return "all";
  if (query.employeeId) return members.some(member => member.id === query.employeeId) ? query.employeeId : selfId;
  if (query.scope === "all" || query.scope === "department") return "all";
  return selfId;
}
