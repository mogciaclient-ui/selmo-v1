"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveTodo, type TodoState } from "@/app/todos/actions";
import type { TodoItem } from "@/infrastructure/supabase/todo-repository";
const input = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
export function TodoList({ items, today }: { items: TodoItem[]; today: string }) {
  const [filter, setFilter] = useState("pending");
  const [state, action, pending] = useActionState(saveTodo, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) formRef.current?.reset(); }, [state]);
  const remaining = items.filter(item => !item.completed_at).length;
  const visible = items.filter(item => filter === "all" || (filter === "completed" ? Boolean(item.completed_at) : !item.completed_at));
  return <div className="p-4 md:p-5">
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
      <input type="hidden" name="operation" value="add"/>
      <label className="min-w-0 flex-1 basis-36 text-xs font-semibold">客先名<input name="customerName" maxLength={200} placeholder="客先名を入力" className={`${input} mt-1.5 w-full`}/></label>
      <label className="min-w-0 flex-1 basis-48 text-xs font-semibold">内容<input name="title" required maxLength={500} placeholder="やることを入力" className={`${input} mt-1.5 w-full`}/></label>
      <label className="text-xs font-semibold">期限（任意）<input name="dueDate" type="date" className={`${input} mt-1.5 block max-w-full`}/></label>
      <button disabled={pending} className="rounded-lg bg-[#f2c94c] px-4 py-2.5 text-sm font-bold disabled:opacity-50">{pending ? "追加中…" : "追加する"}</button>
    </form>
    {state.message && <p role="status" className={`mt-3 text-sm ${state.success ? "text-slate-500" : "text-red-700"}`}>{state.message}</p>}
    <div className="my-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold">未解消 {remaining}件</p><label className="text-xs text-slate-500">表示<select value={filter} onChange={e => setFilter(e.target.value)} className={`${input} ml-2`}><option value="pending">未解消</option><option value="completed">解消</option><option value="all">すべて</option></select></label></div>
    <ul className="divide-y divide-slate-100">{visible.map(item => <TodoRow key={item.id} item={item} today={today}/>)}</ul>
    {!visible.length && <p className="py-10 text-center text-sm text-slate-400">{filter === "completed" ? "解消したToDoはありません。" : filter === "pending" ? "未解消のToDoはありません。" : "ToDoはまだ登録されていません。"}</p>}
    <p className="mt-4 text-xs text-slate-400">自分用のToDoです。他のメンバーには表示されません。</p>
  </div>;
}
function TodoRow({ item, today }: { item: TodoItem; today: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (previous: TodoState, form: FormData) => {
    const result = await saveTodo(previous, form);
    if (result.success) setEditing(false);
    return result;
  }, {});
  const completed = Boolean(item.completed_at);
  return <li className="py-4">
    <div className="flex flex-wrap items-start gap-3"><form action={action}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="operation" value="toggle"/><input type="hidden" name="completed" value={String(!completed)}/><button disabled={pending} aria-label={`${item.title}を${completed ? "未解消に戻す" : "解消にする"}`} aria-pressed={completed} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${completed ? "border-slate-200 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{completed ? "戻す" : "解消"}</button></form>
      <div className="min-w-0 flex-1">{item.customer_name && <p className="mb-1 text-sm font-bold">{item.customer_name}</p>}<p className={`whitespace-pre-wrap break-words text-sm ${completed ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.title}</p>{item.due_date && <p className={`mt-1 text-xs ${!completed && item.due_date < today ? "font-bold text-red-600" : "text-slate-400"}`}>期限：{item.due_date.replaceAll("-", "/")}{!completed && item.due_date < today ? "（期限超過）" : ""}</p>}</div>
      <button type="button" onClick={() => setEditing(!editing)} className="shrink-0 text-xs font-bold text-amber-800">{editing ? "閉じる" : "編集"}</button>
    </div>
    {editing && <form action={action} className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3"><input type="hidden" name="id" value={item.id}/><label className="min-w-0 flex-1 basis-36 text-xs font-semibold">客先名<input name="customerName" maxLength={200} defaultValue={item.customer_name} className={`${input} mt-1 block w-full`}/></label><label className="min-w-0 flex-1 basis-48 text-xs font-semibold">内容<input name="title" required maxLength={500} defaultValue={item.title} className={`${input} mt-1 block w-full`}/></label><label className="text-xs font-semibold">期限<input name="dueDate" type="date" defaultValue={item.due_date ?? ""} className={`${input} mt-1 block`}/></label><button name="operation" value="edit" disabled={pending} className="rounded-lg bg-[#f2c94c] px-3 py-2 text-sm font-bold">保存</button><button name="operation" value="delete" disabled={pending} formNoValidate className="px-3 py-2 text-xs font-bold text-red-600">削除</button></form>}
    {state.message && <p role="status" className={`mt-2 text-xs ${state.success ? "text-slate-500" : "text-red-700"}`}>{state.message}</p>}
  </li>;
}
