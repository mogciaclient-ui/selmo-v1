"use client";

import { useActionState } from "react";
import { changeUserStatus, type UserActionState } from "@/app/users/actions";
const initial: UserActionState = {};
export function UserStatusButton({ id, status }: { id: string; status: "active" | "inactive" }) {
  const [state, action, pending] = useActionState(changeUserStatus, initial);
  return <form action={action}><input type="hidden" name="id" value={id} /><button disabled={pending} className={`rounded-lg px-3 py-2 text-xs font-semibold ${status === "active" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{pending ? "処理中" : status === "active" ? "利用停止" : "再有効化"}</button>{state.message && <p className="mt-1 text-xs text-red-600">{state.message}</p>}</form>;
}
