// OpenAI service layer — Whisper STT, GPT-4o conversation, TTS.
// Every function degrades gracefully to `null` when no OPENAI_API_KEY is
// configured, letting the deterministic pipeline take over (demo-safe).
import type { LangCode, SlotState, Stage, ChatTurn } from "@/lib/types";
import { STAGES } from "@/lib/conversation";
import fs from "fs";
import path from "path";

const KEY = () => process.env.OPENAI_API_KEY ?? "";
export const hasOpenAI = () => Boolean(KEY());

const BASE = "https://api.openai.com/v1";

async function ofetch(path: string, init: RequestInit, timeoutMs = 25000): Promise<Response | null> {
  if (!KEY()) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${KEY()}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      console.error("OpenAI Error:", res.status, await res.text());
      return null;
    }
    return res;
  } catch (e) {
    console.error("ofetch exception:", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------ GPT-4o
export interface LLMStep {
  reply: string;
  language?: LangCode;
  slotUpdates?: Partial<SlotState>;
  stage?: Stage;
  finished?: boolean;
}

let SYSTEM = "";
try {
  SYSTEM = fs.readFileSync(path.join(process.cwd(), "src/data/conversation_system_prompt.txt"), "utf-8");
} catch (e) {
  console.error("Could not load system prompt:", e);
}

export async function llmStep(
  slots: SlotState,
  stage: Stage,
  userText: string,
  transcript: ChatTurn[],
): Promise<LLMStep | null> {
  const payload = {
    current_stage: stage,
    collected_slots: slots,
    user_said: userText,
    recent_transcript: transcript.slice(-6).map((t) => `${t.role}: ${t.text}`),
  };
  for (const model of ["gpt-4o", "gpt-4o-mini"]) {
    const res = await ofetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res) continue;
    try {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        reply?: string; language?: string; advance?: boolean; finished?: boolean;
        profile_updates?: Record<string, unknown>;
      };
      if (!parsed.reply) continue;
      const updates: Partial<SlotState> = {};
      const su = parsed.profile_updates ?? {};
      for (const k of ["name", "village", "district", "state", "education", "familyOccupation", "currentLivelihood", "constraints"] as const) {
        const v = su[k];
        if (typeof v === "string" && v.trim()) updates[k] = v.trim();
      }
      if (typeof su.mobilityKm === "number") updates.mobilityKm = su.mobilityKm;
      if (typeof su.age === "number") updates.age = su.age;
      if (Array.isArray(su.skills)) {
        updates.currentSkills = su.skills.filter((x): x is string => typeof x === "string");
      }
      if (Array.isArray(su.interests)) {
        updates.interestLabels = su.interests.filter((x): x is string => typeof x === "string");
      }
      if (typeof su.work_independence === "string") {
        updates.work_independence = su.work_independence;
      }
      if (typeof su.insights === "string") {
        updates.insights = su.insights;
      }
      if (su.preference === "self" || su.preference === "wage" || su.preference === "either") updates.preference = su.preference;
      if (su.gender === "male" || su.gender === "female" || su.gender === "other") updates.gender = su.gender;
      return {
        reply: parsed.reply,
        language: (parsed.language as LangCode) || undefined,
        slotUpdates: updates,
        finished: Boolean(parsed.finished),
        stage: parsed.finished ? "done" : undefined,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ------------------------------------------------------------------ Whisper
export async function whisperTranscribe(audio: Blob, filename: string): Promise<{ text: string; language?: string } | null> {
  const form = new FormData();
  const buffer = await audio.arrayBuffer();
  const fileBlob = new Blob([buffer], { type: audio.type });
  form.append("file", fileBlob, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  const res = await ofetch("/audio/transcriptions", { method: "POST", body: form }, 30000);
  if (!res) return null;
  try {
    const data = (await res.json()) as { text?: string; language?: string };
    if (!data.text) return null;
    return { text: data.text, language: data.language };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ TTS
export async function openAITTS(text: string, _lang: LangCode): Promise<ArrayBuffer | null> {
  const res = await ofetch(
    "/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: text.slice(0, 900), response_format: "mp3" }),
    },
    25000,
  );
  if (!res) return null;
  try {
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
