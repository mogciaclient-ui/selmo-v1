import type { AuthRole } from "@/lib/auth/types";

export type ManagerNavItem = { href: string; label: string; number: string; match: string[] };
export type ManagerNavGroup = { label: string; items: ManagerNavItem[] };

/** admin（MANAGER CONSOLE）と同じ「番号付き・グループ分け」のメニューに、localhost の機能を割り当てる。 */
export function managerNavGroups(role: AuthRole): ManagerNavGroup[] {
  const enablement: ManagerNavItem[] = [
    { href: "/roleplay", label: "ロープレ", number: "10", match: ["/roleplay"] },
    { href: "/products", label: "商材リスト", number: "11", match: ["/products"] },
    { href: "/manuals", label: "マニュアル", number: "12", match: ["/manuals"] },
    { href: "/checksheets", label: "チェックシート", number: "13", match: ["/checksheets"] },
  ];
  if (role === "organization_admin") enablement.push({ href: "/users", label: "ユーザー管理", number: "14", match: ["/users"] });
  return [
    {
      label: "01 — Coaching",
      items: [
        { href: "/dashboard", label: "ダッシュボード", number: "01", match: ["/dashboard"] },
        { href: "/?view=week", label: "カレンダー", number: "02", match: ["/"] },
        { href: "/analysis", label: "日報・分析", number: "03", match: ["/analysis"] },
        { href: "/opportunities", label: "検討リスト", number: "04", match: ["/opportunities"] },
        { href: "/customers", label: "顧客リスト", number: "05", match: ["/customers"] },
        { href: "/results", label: "打ち漏れ", number: "06", match: ["/results"] },
        { href: "/targets", label: "ターゲット", number: "07", match: ["/targets"] },
      ],
    },
    { label: "02 — Enablement", items: enablement },
  ];
}

export function managerPageLabel(role: AuthRole, active: string) {
  for (const group of managerNavGroups(role)) for (const item of group.items) if (item.match.includes(active)) return item.label;
  return "";
}
