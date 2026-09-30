"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ActivityMemoDialog } from "@/components/activities/activity-memo-dialog";
import { AddScheduleDialog } from "@/components/activities/add-schedule-dialog";

type DepartmentOption = { id: string; name: string };

export function CellCreateMenu({ departments, date, align = "right" }: { departments: DepartmentOption[]; date: string; align?: "left" | "right" }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

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
    <summary ref={summaryRef} onClick={(event) => { event.preventDefault(); const rect = summaryRef.current?.getBoundingClientRect(); if (rect) { const desired = align === "left" ? rect.left : rect.right - 176; setPosition({ left: Math.max(8, Math.min(desired, window.innerWidth - 184)), top: rect.bottom + 4 }); } setOpen((current) => !current); }} aria-label={`${date}の登録メニューを開く`} title="この日に登録" className="grid size-6 cursor-pointer list-none place-items-center rounded-md border border-amber-300 bg-amber-50 text-amber-800 transition marker:hidden hover:bg-[#f2c94c] hover:text-slate-900"><Plus size={14} /></summary>
    <div className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" style={position}>
      <AddScheduleDialog departments={departments} defaultDate={date} trigger="menu" onClose={() => setOpen(false)} />
      <ActivityMemoDialog departments={departments} defaultDate={date} onClose={() => setOpen(false)} />
    </div>
  </details>;
}
