import "server-only";
import { AiError } from "./gemini";

/* Free AI voice-over with Google Gemini's text-to-speech models (uses the same GEMINI_API_KEY). */

const BASE = (process.env.GEMINI_BASE?.trim() || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
const KEY = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
const ENV_MODEL = process.env.GEMINI_TTS_MODEL?.trim();
// Newer models use the Interactions API; older preview models use generateContent. Try both.
const INTERACTION_MODELS = [ENV_MODEL, "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);
const LEGACY_MODELS = [ENV_MODEL, "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

export const VOICES: { id: string; label: string; feel: string }[] = [
  ["Kore", "Firm"], ["Puck", "Upbeat"], ["Zephyr", "Bright"], ["Charon", "Informative"], ["Fenrir", "Excitable"], ["Leda", "Youthful"],
  ["Orus", "Firm"], ["Aoede", "Breezy"], ["Callirrhoe", "Easy-going"], ["Autonoe", "Bright"], ["Enceladus", "Breathy"], ["Iapetus", "Clear"],
  ["Umbriel", "Easy-going"], ["Algieba", "Smooth"], ["Despina", "Smooth"], ["Erinome", "Clear"], ["Algenib", "Gravelly"], ["Rasalgethi", "Informative"],
  ["Laomedeia", "Upbeat"], ["Achernar", "Soft"], ["Alnilam", "Firm"], ["Schedar", "Even"], ["Gacrux", "Mature"], ["Pulcherrima", "Forward"],
  ["Achird", "Friendly"], ["Zubenelgenubi", "Casual"], ["Vindemiatrix", "Gentle"], ["Sadachbia", "Lively"], ["Sadaltager", "Knowledgeable"], ["Sulafat", "Warm"],
].map(([id, feel]) => ({ id, label: id, feel }));

/** 16-bit mono PCM → WAV file. */
export function pcmToWav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
/** Length of a PCM WAV in seconds (reads its header). */
export function wavSeconds(wav: Buffer) {
  if (wav.toString("ascii", 0, 4) !== "RIFF") return 0;
  const byteRate = wav.readUInt32LE(28) || 48000;
  let off = 12;
  while (off + 8 <= wav.length) { const id = wav.toString("ascii", off, off + 4); const size = wav.readUInt32LE(off + 4); if (id === "data") return Math.min(size, wav.length - off - 8) / byteRate; off += 8 + size; }
  return (wav.length - 44) / byteRate;
}

function toWav(b64: string, mime = ""): Buffer {
  const raw = Buffer.from(b64, "base64");
  if (raw.toString("ascii", 0, 4) === "RIFF") return raw;
  const rate = Number(mime.match(/rate=(\d+)/)?.[1]) || 24000;
  return pcmToWav(raw, rate);
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(90000) });
  return { res, json: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Speaks `text` with a prebuilt voice. Returns a WAV file and its length. */
export async function speak(text: string, voice = "Kore", style = "warm, confident, natural advertising voice-over"): Promise<{ wav: Buffer; seconds: number; model: string }> {
  if (!KEY) throw new AiError("AI voice needs GEMINI_API_KEY in Vercel (free from aistudio.google.com).");
  const t = text.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!t) throw new AiError("There's nothing to read out — write the voice-over first.");
  const v = VOICES.some((x) => x.id === voice) ? voice : "Kore";
  let last = "";
  let limited = 0;
  for (const model of INTERACTION_MODELS) {
    try {
      const { res, json } = await post(`${BASE}/v1beta/interactions`, {
        model, input: [{ type: "user_input", content: [{ type: "text", text: t, annotations: [{ type: "speech_metadata", style }] }] }],
        response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: v }] },
      });
      if (res.status === 429) { limited++; last = "free limit reached"; continue; } // each voice model has its own quota
      if (res.status === 400 && /api key/i.test(json?.error?.message ?? "")) throw new AiError("The GEMINI_API_KEY in Vercel isn't valid.");
      if (!res.ok) { last = json?.error?.message ?? `error ${res.status}`; continue; }
      const audio = (json.steps ?? []).filter((s: { type?: string }) => s.type === "model_output").flatMap((s: { content?: unknown[] }) => s.content ?? []).filter((c: { type?: string }) => c.type === "audio").pop() as { data?: string; mime_type?: string } | undefined;
      if (audio?.data) { const wav = toWav(audio.data, audio.mime_type); return { wav, seconds: wavSeconds(wav), model }; }
      last = "no audio returned";
    } catch (e) { if (e instanceof AiError) throw e; last = (e as Error).name === "TimeoutError" ? "timed out" : "couldn't reach Gemini"; }
  }
  for (const model of LEGACY_MODELS) {
    try {
      const { res, json } = await post(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: `Say in a ${style} tone: ${t}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } } },
      });
      if (res.status === 429) { limited++; last = "free limit reached"; continue; }
      if (!res.ok) { last = json?.error?.message ?? `error ${res.status}`; continue; }
      const part = (json?.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
      if (part) { const wav = toWav(part.inlineData.data, part.inlineData.mimeType); return { wav, seconds: wavSeconds(wav), model }; }
      last = "no audio returned";
    } catch (e) { if (e instanceof AiError) throw e; last = (e as Error).name === "TimeoutError" ? "timed out" : "couldn't reach Gemini"; }
  }
  if (limited) throw new AiError("The free AI-voice limit on this Gemini key is used up for now (free voice models allow only a few requests per minute and per day). Try again later, or export the video with music and captions only — it still works without a voice-over.");
  throw new AiError(`AI voice isn't available on this Gemini key right now (${last.slice(0, 120)}). You can still export the video with music and captions, or set GEMINI_TTS_MODEL.`);
}
