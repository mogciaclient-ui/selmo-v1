"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

export function ManagerMobileMenu({ children }: { children: React.ReactNode }) {
  // 開いたときのパスを覚えておき、ページを移動したら自動で閉じる。
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (value: boolean) => setOpenedAt(value ? pathname : null);
  return <div className="lg:hidden">
    <button type="button" aria-label="メニューを開く" onClick={() => setOpen(true)} className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#e8ebf0] bg-white shadow-[0_8px_20px_rgba(17,24,39,0.04)] transition hover:border-[#f0c655] hover:bg-[#fffdf7]">
      <span className="flex flex-col items-center justify-center gap-1.5"><span className="h-0.5 w-5 rounded-full bg-[#343b48]" /><span className="h-0.5 w-5 rounded-full bg-[#343b48]" /><span className="h-0.5 w-5 rounded-full bg-[#343b48]" /></span>
    </button>
    {open && <div className="fixed inset-0 z-50">
      <button type="button" aria-label="メニューを閉じる" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#171717]/30" />
      <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-white px-4 py-7 shadow-xl">
        <button type="button" aria-label="メニューを閉じる" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-2 text-[#9aa1ad] hover:bg-[#f7f7fa]"><X size={18} /></button>
        {children}
      </aside>
    </div>}
  </div>;
}
