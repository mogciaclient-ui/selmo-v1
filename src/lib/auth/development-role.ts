import { authRoles } from "./roles.ts";
import type { AuthRole } from "./types.ts";

export const DEVELOPMENT_ROLE_COOKIE = "selmo_development_role";
const developmentUid = "glyYq4V5XeS1mNkAFCbfGnu3YeP2";

export function canSwitchDevelopmentRole(uid: string, baseRole: AuthRole) {
  return uid === developmentUid && baseRole === "organization_admin";
}

export function resolveDevelopmentRole(uid: string, baseRole: AuthRole, value?: string): AuthRole {
  if (!canSwitchDevelopmentRole(uid, baseRole)) return baseRole;
  const role = value?.startsWith(`${uid}:`) ? value.slice(uid.length + 1) : undefined;
  return authRoles.find((candidate) => candidate === role) ?? baseRole;
}
