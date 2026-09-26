"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ActivityMemoDialog } from "@/components/activities/activity-memo-dialog";
import { AddScheduleDialog } from "@/components/activities/add-schedule-dialog";

type DepartmentOption = { id: string; name: string };

export function CellCreateMenu({ departments, date }: { departments: DepartmentOption[]; date: string }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <details ref={menuRef} open={open} className="group relative">
    <summary onClick={(event) => { event.preventDefault(); setOpen((current) => !current); }} aria-label={`${date}の登録メニューを開く`} title="この日に登録" className="grid size-6 cursor-pointer list-none place-items-center rounded-md border border-amber-300 bg-amber-50 text-amber-800 transition marker:hidden hover:bg-[#f2c94c] hover:text-slate-900"><Plus size={14} /></summary>
    <div className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      <AddScheduleDialog departments={departments} defaultDate={date} trigger="menu" />
      <ActivityMemoDialog departments={departments} defaultDate={date} />
    </div>
  </details>;
}
