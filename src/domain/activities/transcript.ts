export const MAX_TRANSCRIPT_LENGTH = 30_000;
export function insertTranscript(current: string, pasted: string, start: number, end: number) {
  const text = pasted.replace(/\r\n?/g, "\n").replaceAll("\u0000", "");
  const from = Math.max(0, Math.min(start, current.length));
  const to = Math.max(from, Math.min(end, current.length));
  return { value: current.slice(0, from) + text + current.slice(to), cursor: from + text.length };
}
