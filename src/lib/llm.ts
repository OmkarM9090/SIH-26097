// OpenAI service layer — Whisper STT, GPT-4o conversation, TTS.
// Every function degrades gracefully to `null` when no OPENAI_API_KEY is
// configured, letting the deterministic pipeline take over (demo-safe).
import type { LangCode, SlotState, Stage, ChatTurn } from "@/lib/types";
import { CONVERSATION_SYSTEM_PROMPT } from "@/data/prompts";

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
      console.error("OpenAI Error:", res.status, (await res.text()).slice(0, 300));
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

// The prompt is imported (not read from disk) so it survives bundling.
const SYSTEM = CONVERSATION_SYSTEM_PROMPT;

/**
 * Phrase ONE interview turn.
 *
 * `suggestedReply` is the deterministic reply (acknowledgement + the exact next
 * question). The model is told to keep that meaning — it may warm up the
 * wording, mirror the beneficiary's dialect, answer an interrupting question
 * first, and must always finish by asking the same question. The route then
 * verifies the result before it is spoken, so the interview flow is safe even
 * if the model misbehaves.
 */
export async function llmStep(
  slots: SlotState,
  stage: Stage,
  userText: string,
  transcript: ChatTurn[],
  suggestedReply?: string,
): Promise<LLMStep | null> {
  const lastUserTurns = transcript.filter((t) => t.role === "user").slice(-4).map((t) => t.text);
  const payload = {
    current_stage: stage,
    collected_slots: slots,
    user_said: userText,
    recent_user_answers: lastUserTurns,
    deterministic_draft_reply: suggestedReply ?? "",
    instruction:
      "Rewrite deterministic_draft_reply so it sounds like a warm human field worker on a phone call. " +
      "Keep every fact and the SAME final question. Reply in the beneficiary's language. Max 2 short sentences.",
  };

  for (const model of ["gpt-4o", "gpt-4o-mini"]) {
    const res = await ofetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 260,
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
export async function whisperTranscribe(
  audio: Blob,
  filename: string,
  language?: LangCode,
): Promise<{ text: string; language?: string } | null> {
  const form = new FormData();
  const buffer = await audio.arrayBuffer();
  const fileBlob = new Blob([buffer], { type: audio.type });
  form.append("file", fileBlob, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "json");
  // The language hint measurably improves Indic-script accuracy.
  if (language) form.append("language", language);
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
/**
 * Natural, human-sounding voice for the spoken channels. `gpt-4o-mini-tts`
 * accepts delivery instructions ("warm Indian field worker, unhurried"), which
 * sounds far more human than the flat tts-1 voices; tts-1 is the fallback for
 * keys/orgs without the newer model.
 */
export async function openAITTS(text: string, lang: LangCode): Promise<ArrayBuffer | null> {
  const input = text.slice(0, 900);
  const instructions =
    "Speak like a warm, patient female government field worker from India talking to a rural beneficiary on a phone call. " +
    "Unhurried, clear, caring, natural pauses. Never robotic or salesy.";

  const modern = await ofetch(
    "/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "shimmer",
        input,
        instructions,
        response_format: "mp3",
      }),
    },
    25000,
  );
  if (modern) {
    try {
      return await modern.arrayBuffer();
    } catch { /* fall through */ }
  }

  const legacy = await ofetch(
    "/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        voice: lang === "en" ? "nova" : "shimmer",
        input,
        speed: 0.95,
        response_format: "mp3",
      }),
    },
    25000,
  );
  if (!legacy) return null;
  try {
    return await legacy.arrayBuffer();
  } catch {
    return null;
  }
}
