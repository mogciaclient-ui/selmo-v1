import { switchHybridView } from "@/app/auth/hybrid-view-action";
import type { ViewMode } from "@/lib/auth/view-mode";

const labels = { sales: "営業画面", manager: "部門管理画面" } as const;

export function HybridViewSwitch({ mode }: { mode: ViewMode }) {
  return (
    <form action={switchHybridView} aria-label="表示する画面" className="flex flex-wrap gap-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold md:px-8">
      {(["sales", "manager"] as const).map((option) => (
        <button
          key={option}
          type="submit"
          name="mode"
          value={option}
          aria-current={mode === option ? "true" : undefined}
          disabled={mode === option}
          className={mode === option
            ? "rounded-md bg-slate-900 px-3 py-1.5 text-white"
            : "rounded-md px-3 py-1.5 text-slate-700 hover:bg-amber-100"}
        >
          {labels[option]}
        </button>
      ))}
    </form>
  );
}
