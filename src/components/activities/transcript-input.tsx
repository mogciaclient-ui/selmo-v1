"use client";
import { useId, useRef, useState } from "react";
import { insertTranscript, MAX_TRANSCRIPT_LENGTH } from "@/domain/activities/transcript";

// Own state only: pasting a transcript never changes report category, status,
// product rows, or the mounting of any other business field.
export function TranscriptInput() {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [transcript, setTranscript] = useState("");
  const overLimit = transcript.length > MAX_TRANSCRIPT_LENGTH;
  function validate(value: string) {
    ref.current?.setCustomValidity(value.length > MAX_TRANSCRIPT_LENGTH ? "文字起こしは30,000文字以内にしてください。" : "");
  }
  return <div className="min-w-0 max-w-full">
    <label htmlFor={id} className="block text-xs font-bold text-slate-600">商談・通話の文字起こし</label>
    <textarea ref={ref} id={id} name="aiTranscript" rows={10} value={transcript} aria-describedby={`${id}-help`} aria-invalid={overLimit || undefined}
      onChange={event => { setTranscript(event.target.value); validate(event.target.value); }}
      onPaste={event => {
        const pasted = event.clipboardData.getData("text/plain");
        if (!pasted) return;
        event.preventDefault(); event.stopPropagation();
        const field = event.currentTarget;
        const next = insertTranscript(field.value, pasted, field.selectionStart, field.selectionEnd);
        setTranscript(next.value); validate(next.value);
        requestAnimationFrame(() => { ref.current?.setSelectionRange(next.cursor, next.cursor); });
      }}
      placeholder="文字起こし済みの全文を、そのまま貼り付けてください。"
      style={{ height: "16rem", minHeight: "8rem", maxHeight: "24rem", overflowY: "auto", overflowAnchor: "none", resize: "vertical" }}
      className="mt-2 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 p-3 text-sm leading-7 outline-none focus:border-amber-500"/>
    <p id={`${id}-help`} className={`mt-2 text-xs ${overLimit ? "font-bold text-red-600" : "text-slate-500"}`} role={overLimit ? "alert" : undefined}>{transcript.length.toLocaleString("ja-JP")} / 30,000文字{overLimit ? "：上限を超えています。貼り付けた内容は保持しています。分割・短縮してから登録してください。" : "。貼り付け後も、上のタブから他の入力項目を確認できます。"}</p>
  </div>;
}
