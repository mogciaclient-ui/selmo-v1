import assert from "node:assert/strict";
import test from "node:test";
import { applyMicrophoneState, parseRealtimeEvent, RealtimeTranscript } from "../src/lib/roleplay/realtime-state.ts";
import { insertTranscript, MAX_TRANSCRIPT_LENGTH } from "../src/domain/activities/transcript.ts";

test("ミュートしたまま一時停止・再開してもマイクを勝手に有効にしない", () => {
  const tracks = [{ enabled: true }, { enabled: true }];
  const stream = { getAudioTracks: () => tracks };
  for (const [muted, paused, ending, expected] of [[true,false,false,false], [true,true,false,false], [true,false,false,false], [false,false,false,true], [false,true,false,false], [false,false,true,false]]) {
    applyMicrophoneState(stream, muted, paused, ending);
    assert(tracks.every(track => track.enabled === expected));
  }
  assert.doesNotThrow(() => applyMicrophoneState(null, false, false));
});
test("営業の文字起こしがAIより遅れて届いても会話順を保ち、重複しない", () => {
  const state = new RealtimeTranscript();
  state.process({type:"input_audio_buffer.speech_started",item_id:"user-1"});
  assert.equal(state.pending.size, 1, "終了操作の直前でも、発話開始時点から最終文字起こしを待つ");
  state.process({type:"input_audio_buffer.committed",item_id:"user-1"});
  state.process({type:"response.output_item.added",item:{id:"ai-1",role:"assistant"}});
  state.process({type:"response.output_audio_transcript.done",item_id:"ai-1",transcript:"現在の環境を説明します。"});
  state.process({type:"conversation.item.input_audio_transcription.completed",item_id:"user-1",transcript:"環境を教えてください。"});
  state.process({type:"conversation.item.input_audio_transcription.completed",item_id:"user-1",transcript:"環境を教えてください。"});
  assert.deepEqual(state.messages, [{role:"sales",text:"環境を教えてください。"},{role:"customer",text:"現在の環境を説明します。"}]);
  assert.equal(state.pending.size, 0);
});
test("文字起こし失敗を待ち続けず、再接続しても既存の会話は残す", () => {
  const old = [{role:"customer",text:"こんにちは。"}];
  const state = new RealtimeTranscript(old);
  state.process({type:"input_audio_buffer.committed",item_id:"user-2"});
  state.process({type:"conversation.item.input_audio_transcription.failed",item_id:"user-2"});
  assert.equal(state.pending.size, 0);
  assert.deepEqual(state.messages, old);
  state.process({type:"response.created"}); assert.equal(state.responseActive, true);
  state.process({type:"response.done"}); assert.equal(state.responseActive, false);
});
test("壊れたデータチャネルのイベントで音声UIをクラッシュさせない", () => {
  for (const raw of ["invalid", "null", "42", {}, null]) assert.equal(parseRealtimeEvent(raw), null);
  assert.equal(parseRealtimeEvent('{"type":"input_audio_buffer.speech_started"}').type, "input_audio_buffer.speech_started");
});
test("文字起こしの貼り付けは選択範囲だけを置換し、HTMLや長文もテキストとして保持", () => {
  assert.deepEqual(insertTranscript("営業：あいう", "顧客：確認\r\n", 3, 5), {value:"営業：顧客：確認\nう",cursor:9});
  const html = '<select name="salesType"><option>別項目</option></select>';
  assert.equal(insertTranscript("", html, 0, 0).value, html);
  const long = "発言\n".repeat(MAX_TRANSCRIPT_LENGTH);
  assert.equal(insertTranscript("", long, 0, 0).value, long, "上限超過でも貼り付け内容を黙って削除しない");
});
