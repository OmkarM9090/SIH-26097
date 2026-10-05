// POST /api/conversation/message — one conversational turn (Module 1/3 core).
//
// Pipeline per turn:
//   user text → language confirm/detect → slot extraction (deterministic NLU)
//   → GPT-4o phrasing when keyed (fallback: scripted empathetic replies)
//   → persist transcript/slots/stage in MongoDB → JSON reply for TTS.
//
// PRODUCTION HARDENING (why this route is defensive):
//   • The deterministic state machine is ALWAYS the source of truth for
//     `stage` and `slots`. The LLM may only rephrase the reply, so a bad model
//     response can never skip a question or lose an answer.
//   • Deployments on serverless/ephemeral hosts (or a MongoDB outage) get the
//     full conversation state from the client and continue statelessly instead
//     of returning "session not found" — the interview must never break.
//   • Every failure path still returns a valid spoken reply.
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import type { Channel, ChatTurn, ConversationReply, LangCode, SlotState, Stage } from "@/lib/types";
import {
  fallbackStep, greeting, stageProgress, detectIntent, currentQuestion,
} from "@/lib/conversation";
import { llmStep, hasOpenAI } from "@/lib/llm";
import { detectLanguage } from "@/data/skills";
import { LANG_NAME } from "@/data/i18n";

export const dynamic = "force-dynamic";

const ALLOWED: LangCode[] = ["hi", "en", "ta", "te", "mr", "bn"];

function asLang(x: unknown, fallback: LangCode): LangCode {
  return ALLOWED.includes(x as LangCode) ? (x as LangCode) : fallback;
}

function asStage(x: unknown): Stage | undefined {
  const stages: Stage[] = ["name", "location", "education", "family_occupation", "current_livelihood", "interests", "employment", "mobility", "physical", "confirm", "done"];
  return stages.includes(x as Stage) ? (x as Stage) : undefined;
}

/** Reject LLM phrasing that would break the voice interview. */
function llmReplyUsable(reply: string, done: boolean, lang: LangCode): boolean {
  const t = reply.trim();
  if (t.length < 6 || t.length > 520) return false;
  if (!/[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0980-\u09FFa-zA-Z]/.test(t)) return false;
  if (done) return true;
  // the agent must always leave the beneficiary a question to answer
  if (!/[?？]/.test(t)) return false;
  // crude wrong-language guard: Devanagari expected for hi/mr, Latin for en
  if ((lang === "en") && !/[a-zA-Z]/.test(t)) return false;
  if ((lang === "hi" || lang === "mr") && /^[a-zA-Z\s.,'"]+$/.test(t)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    channel?: Channel;
    lang?: LangCode;
    userText?: string;
    slots?: SlotState;
    stage?: Stage;
    /** Set by the client when it only wants the pending question re-spoken. */
    keepStage?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch { /* empty body → treated as a fresh session */ }

  const channel: Channel = body.channel === "ivr" || body.channel === "whatsapp" ? body.channel : "web";
  const lang = asLang(body.lang, "hi");

  // ─────────────────────────────────────────────── new session (greeting only)
  if (!body.sessionId && !body.slots) {
    const replyTxt = greeting(lang);
    try {
      const db = await getDb();
      const doc = {
        channel, language: lang, transcript: [{ role: "assistant", text: replyTxt, lang, at: Date.now() }],
        slots: {}, stage: "name", done: false, createdAt: new Date(), updatedAt: new Date(),
      };
      const result = await db.collection("conversations").insertOne(doc);
      const out: ConversationReply = {
        id: result.insertedId.toString(), reply: replyTxt, language: lang, stage: "name",
        progress: stageProgress("name"), done: false, slots: {}, aiPowered: hasOpenAI(),
      };
      return Response.json(out);
    } catch {
      // Storage down: hand the client a local session id; the client keeps the
      // state and sends it back with every later turn (stateless mode).
      return Response.json({
        id: `local-${Date.now().toString(36)}`, reply: replyTxt, language: lang, stage: "name",
        progress: stageProgress("name"), done: false, slots: {}, aiPowered: false,
      } satisfies ConversationReply);
    }
  }

  // ───────────────────────────────────────────────────────── existing session
  let transcript: ChatTurn[] = [];
  let slots: SlotState = body.slots && typeof body.slots === "object" ? { ...body.slots } : {};
  let stage: Stage = asStage(body.stage) ?? "name";
  let effLang: LangCode = lang;
  let sessionKey: string | null = body.sessionId ?? null;
  let knownSession = false;

  if (body.sessionId) {
    try {
      const db = await getDb();
      let qId: ObjectId | string = body.sessionId;
      try { qId = new ObjectId(body.sessionId); } catch { /* keep the raw string id */ }
      const row = await db.collection("conversations").findOne({ _id: qId as never });
      if (row) {
        knownSession = true;
        transcript = ((row.transcript as ChatTurn[]) ?? []).slice();
        // Client state (if provided) is fresher than a lazily-persisted row.
        if (!body.slots) slots = (row.slots as SlotState) ?? {};
        if (!asStage(body.stage)) stage = (row.stage as Stage) ?? "name";
        effLang = asLang(row.language, lang);
      }
    } catch { /* DB unreachable → continue statelessly with client state */ }
  }
  // When no sessionId arrives (or the row vanished), the turn is served
  // statelessly from the client-supplied slots and persisted below if possible.

  const userText = (body.userText ?? "").trim();
  if (!userText) {
    // Client asked only for the current question (e.g. after a language switch).
    const question = currentQuestion(slots, stage, lang);
    return Response.json({
      id: sessionKey ?? `local-${Date.now().toString(36)}`, reply: question, language: lang,
      stage, progress: stageProgress(stage), done: false, slots,
      aiPowered: false, retry: true,
    } satisfies ConversationReply);
  }

  // Language: the client is the source of truth (the beneficiary can switch
  // languages mid-interview); script detection fills in when the client did not.
  if (!body.lang) effLang = asLang(detectLanguage(userText), effLang);

  transcript.push({ role: "user", text: userText, lang: effLang, at: Date.now() });

  // ── 1. deterministic engine is authoritative (flow can never break)
  const intent = detectIntent(userText, stage);
  const step = fallbackStep(slots, stage, userText, effLang);

  let replyTxt = step.reply;
  let aiPowered = false;
  slots = step.slots;
  stage = step.stage;
  let done = step.done;

  // ── 2. LLM upgrade (phrasing + extra slots only; never the flow)
  if (hasOpenAI() && !done) {
    try {
      const llm = await llmStep(step.slots, step.stage, userText, transcript, replyTxt);
      if (llm) {
        const candidate = llm.reply.trim();
        if (llmReplyUsable(candidate, false, effLang)) {
          replyTxt = candidate;
          aiPowered = true;
        } else {
          console.warn("[JeevikaSetu] Discarded unusable LLM reply:", candidate.slice(0, 120));
        }
        if (llm.slotUpdates) {
          // Deterministic values win; the model only fills gaps.
          const extra: Partial<SlotState> = {};
          for (const [k, v] of Object.entries(llm.slotUpdates)) {
            const key = k as keyof SlotState;
            const existing = step.slots[key];
            const empty = existing === undefined || existing === null || existing === "" ||
              (Array.isArray(existing) && existing.length === 0);
            if (empty && v !== undefined && v !== null && v !== "") {
              (extra as Record<string, unknown>)[key] = v;
            }
          }
          slots = { ...step.slots, ...extra };
        }
      }
    } catch (e) {
      console.warn("[JeevikaSetu] LLM step failed, using deterministic reply:", String(e));
    }
  }

  // readable interest labels for the profile screen
  if (slots.interests?.length && !slots.interestLabels?.length) {
    const { SKILL_MAP } = await import("@/data/skills");
    slots.interestLabels = slots.interests.map((id) => SKILL_MAP.get(id)?.en ?? id);
  }
  if (!slots.languages?.length) slots.languages = [LANG_NAME[effLang] ?? "Hindi"];

  transcript.push({ role: "assistant", text: replyTxt, lang: effLang, at: Date.now() });

  // ── 3. best-effort persistence (never blocks the reply)
  if (!sessionKey || !sessionKey.startsWith("local-")) {
    try {
      const db = await getDb();
      let qId: ObjectId | string = sessionKey ?? "";
      try { qId = new ObjectId(sessionKey ?? ""); } catch { /* raw id */ }
      if (knownSession && sessionKey) {
        await db.collection("conversations").updateOne(
          { _id: qId as never },
          { $set: { transcript, slots, stage, done, language: effLang, updatedAt: new Date() } },
        );
      } else {
        // New or vanished session (ephemeral store / serverless cold start):
        // create it with the client-supplied state so the interview continues
        // seamlessly AND gets a persisted id from here on.
        const result = await db.collection("conversations").insertOne({
          channel, language: effLang, transcript, slots, stage, done,
          createdAt: new Date(), updatedAt: new Date(),
        });
        sessionKey = result.insertedId.toString();
      }
    } catch { /* keep serving the reply */ }
  }

  const out: ConversationReply = {
    id: sessionKey ?? `local-${Date.now().toString(36)}`,
    reply: replyTxt,
    language: effLang,
    stage,
    progress: stageProgress(stage),
    done,
    slots,
    aiPowered,
    intent,
    retry: step.retry,
  };
  return Response.json(out);
}
