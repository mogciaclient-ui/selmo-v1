import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-white/75 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-lg">
        <LoaderCircle className="animate-spin text-amber-600" size={20} aria-hidden="true" />
        読み込み中…
      </div>
    </div>
  );
}
