import type { AuthRole } from "./types.ts";

/** 開発用ロール切り替えで「旧selmo」を選んだときだけ、admin（MANAGER CONSOLE）と同じUIで表示する。 */
export const HYBRID_MANAGER_VIEW_COOKIE = "selmo_hybrid_manager_view";
export const LEGACY_UI_COOKIE = "selmo_legacy_ui";
export const LEGACY_UI_OPTION = "legacy_selmo";
export const LEGACY_UI_LABEL = "旧selmo";
/** 旧selmo はこのロールの権限で動かす（全部署を見られる本部管理者）。 */
export const LEGACY_UI_ROLE: AuthRole = "organization_admin";
export type ViewMode = "sales" | "manager";

export function resolveViewMode(canSwitchRole: boolean | undefined, uid: string, cookieValue?: string): ViewMode {
  return canSwitchRole && cookieValue === uid ? "manager" : "sales";
}
