export type VoiceMessage = { role: "sales" | "customer"; text: string };
export type RealtimeEvent = { type: string; item_id?: string; event_id?: string; response_id?: string; transcript?: string; error?: { code?: string; message?: string }; item?: { id?: string; role?: string }; response?: { status?: string; status_details?: { error?: { message?: string } } } };
export function parseRealtimeEvent(raw: unknown): RealtimeEvent | null {
  try {
    const event = typeof raw === "string" ? JSON.parse(raw) : raw;
    return event && typeof event === "object" && typeof event.type === "string" ? event : null;
  } catch { return null; }
}
export function applyMicrophoneState(stream: Pick<MediaStream, "getAudioTracks"> | null, muted: boolean, paused: boolean, finishing = false) {
  stream?.getAudioTracks().forEach(track => { track.enabled = !muted && !paused && !finishing; });
}
// Input transcription and AI output arrive asynchronously. Item IDs preserve the
// conversational order and prevent retransmitted final events duplicating text.
export class RealtimeTranscript {
  private entries = new Map<string, { role: VoiceMessage["role"]; text: string }>();
  readonly pending = new Set<string>();
  speaking = false;
  responseActive = false;
  private initial: VoiceMessage[];
  constructor(initial: VoiceMessage[] = []) { this.initial = initial; }
  get messages(): VoiceMessage[] { return [...this.initial, ...this.entries.values()].filter(entry => entry.text.trim()); }
  process(event: RealtimeEvent) {
    const id = event.item_id ?? event.item?.id;
    if (event.type === "input_audio_buffer.speech_started") {
      this.speaking = true;
      if (id) { this.pending.add(id); if (!this.entries.has(id)) this.entries.set(id, { role: "sales", text: "" }); }
    }
    if (event.type === "input_audio_buffer.speech_stopped") this.speaking = false;
    if (event.type === "input_audio_buffer.committed" && id) {
      this.pending.add(id); this.speaking = false;
      if (!this.entries.has(id)) this.entries.set(id, { role: "sales", text: "" });
    }
    if ((event.type === "conversation.item.created" || event.type === "conversation.item.added" || event.type === "response.output_item.added") && id && event.item?.role === "assistant" && !this.entries.has(id)) this.entries.set(id, { role: "customer", text: "" });
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      if (id) this.pending.delete(id);
      if (event.transcript?.trim()) this.entries.set(id ?? event.event_id ?? `sales-${this.entries.size}`, { role: "sales", text: event.transcript.trim() });
    }
    if (event.type === "conversation.item.input_audio_transcription.failed" && id) this.pending.delete(id);
    if (["response.output_audio_transcript.done", "response.audio_transcript.done"].includes(event.type) && event.transcript?.trim()) this.entries.set(id ?? event.response_id ?? event.event_id ?? `customer-${this.entries.size}`, { role: "customer", text: event.transcript.trim() });
    if (event.type === "response.created") this.responseActive = true;
    if (event.type === "response.done") this.responseActive = false;
  }
}
