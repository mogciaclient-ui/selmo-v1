import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-[#f2c94c] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[#e0b72f] bg-white p-8 shadow-[0_24px_70px_rgba(92,67,0,0.20)] md:p-10">
        <div className="mb-8 text-center"><p className="text-3xl font-bold tracking-[-0.04em] text-slate-950">selmo<span className="text-[#f2c94c]">.</span></p><p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-slate-400">SALES ENABLEMENT</p></div>
        <h1 className="text-center text-xl font-bold">ログイン</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">会社から発行されたアカウントで<br />ログインしてください。</p>
        <LoginForm />
      </section>
    </main>
  );
}
