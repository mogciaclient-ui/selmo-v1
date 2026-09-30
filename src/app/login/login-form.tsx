"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

function firebaseMessage(error: FirebaseError) {
  switch (error.code) {
    case "auth/invalid-credential":
      return "Firebaseに登録されているメールアドレスまたはパスワードと一致しません。";
    case "auth/too-many-requests":
      return "ログイン試行が一時的に制限されています。少し待ってから再度お試しください。";
    case "auth/network-request-failed":
      return "認証サーバーへ接続できません。通信状態を確認して再度お試しください。";
    case "auth/operation-not-allowed":
      return "メールアドレスとパスワードによるログインが無効です。管理者へ連絡してください。";
    case "auth/invalid-api-key":
      return "認証設定に誤りがあります。管理者へ連絡してください。";
    default:
      return `ログインできませんでした（${error.code}）。`;
  }
}

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function handleSubmit(formData: FormData) {
    setPending(true);
    setMessage(undefined);
    const auth = getFirebaseClientAuth();
    try {
      await setPersistence(auth, inMemoryPersistence);
      const email = String(formData.get("email")).trim().toLowerCase();
      const credential = await signInWithEmailAndPassword(auth, email, String(formData.get("password")));
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken() }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        console.error("[login] session creation failed", { status: response.status, error: body?.error });
        setMessage(response.status === 403
          ? "認証には成功しましたが、このアカウントはSFAを利用できません。管理者へ連絡してください。"
          : "認証には成功しましたが、ログイン状態を作成できませんでした。もう一度お試しください。");
        await signOut(auth);
        setPending(false);
        return;
      }
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("[login] firebase authentication failed", error);
      setMessage(error instanceof FirebaseError
        ? firebaseMessage(error)
        : "ログイン処理中に予期しないエラーが発生しました。もう一度お試しください。");
      setPending(false);
    }
  }
  return (
    <form action={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">メールアドレス</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#d4a900] focus:ring-4 focus:ring-amber-100" placeholder="name@example.com" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">パスワード</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm outline-none transition focus:border-[#d4a900] focus:ring-4 focus:ring-amber-100" placeholder="パスワードを入力" />
          <button
            type="button"
            aria-label={showPassword ? "パスワードを非表示にする" : "パスワードを表示する"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
          >
            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f2c94c] text-sm font-bold text-slate-900 transition hover:bg-[#ddb62f] disabled:cursor-wait disabled:opacity-70">
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : <LogIn size={18} />}{pending ? "ログイン中..." : "ログイン"}
      </button>
      <Link href="/auth/forgot-password" className="block text-center text-sm font-semibold text-amber-800">パスワードを設定・再設定する</Link>
    </form>
  );
}
