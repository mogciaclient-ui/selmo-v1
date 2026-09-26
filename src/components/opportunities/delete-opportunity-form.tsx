"use client";
import { Trash2 } from "lucide-react";
import { deleteOpportunity } from "@/app/opportunities/actions";
export function DeleteOpportunityForm({id}:{id:string}){return <form action={deleteOpportunity} onSubmit={event=>{if(!window.confirm("この案件を削除しますか？この操作は取り消せません。"))event.preventDefault()}}><input type="hidden" name="id" value={id}/><button className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"><Trash2 size={17}/>削除</button></form>}
