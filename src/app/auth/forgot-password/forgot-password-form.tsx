"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true); setMessage(undefined);
    try {
      await sendPasswordResetEmail(getFirebaseClientAuth(), String(formData.get("email")), { url: `${window.location.origin}/login` });
      setSuccess(true);
    } catch { setMessage("メールを送信できませんでした。メールアドレスを確認してください。"); }
    finally { setPending(false); }
  }
  if (success) return <div className="mt-8"><div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">パスワード設定メールを送りました。メール内のリンクを開いてください。</div><Link href="/login" className="mt-5 block text-center text-sm font-semibold text-amber-800">ログインへ戻る</Link></div>;
  return <form action={submit} className="mt-8 space-y-5"><label className="block text-sm font-semibold text-slate-700">メールアドレス<input name="email" type="email" autoComplete="email" required className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>{message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}<button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f2c94c] text-sm font-bold text-slate-900 disabled:opacity-60">{pending ? <LoaderCircle size={18} className="animate-spin" /> : <Mail size={18} />}{pending ? "送信中..." : "設定メールを送る"}</button><Link href="/login" className="block text-center text-sm font-semibold text-slate-500">ログインへ戻る</Link></form>;
}
