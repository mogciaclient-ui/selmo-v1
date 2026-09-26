import { ForgotPasswordForm } from "@/app/auth/forgot-password/forgot-password-form";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-2xl font-bold text-slate-950">selmo<span className="text-[#f2c94c]">.</span></p><h1 className="mt-8 text-2xl font-bold">パスワードを設定</h1><p className="mt-2 text-sm leading-6 text-slate-500">登録済みのメールアドレスへ、パスワード設定用リンクを送ります。</p><ForgotPasswordForm /></section></main>;
}
